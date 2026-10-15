import { evaluateConfluence, evaluatePriceDeltaDivergence } from './confluence.js';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const formatTime = (at) => new Date(at).toLocaleTimeString('en-US', { hour12: false });
const color = { green: '#75c69e', red: '#dc8089', text: '#aeb9ca', grid: 'rgba(185,196,210,.14)' };

/** Read-only visualizer: replay is never injected into live market or alert runtimes. */
export function createMarketReplayRenderer({ doc = document } = {}) {
  const get = (suffix) => doc.getElementById(`dashboardReplay${suffix}`);
  const panel = get('Panel'), status = get('Status'), detail = get('Details'), confluence = get('Confluence');
  const axis = get('Axis'), progress = get('Timeline'), slider = get('Position');
  const priceCanvas = get('PriceCanvas'), deltaCanvas = get('DeltaCanvas'), heatmapCanvas = get('HeatmapCanvas');
  let disposed = false;
  function prepare(canvas) {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return null;
    const width = Math.max(120, Math.round(canvas.getBoundingClientRect().width || 600));
    const height = 112, scale = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    canvas.width = Math.round(width * scale); canvas.height = height * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }
  function placeholder(ctx, text) {
    ctx.fillStyle = color.text; ctx.font = '11px system-ui'; ctx.fillText(text, 12, 55);
  }
  function plotLine(canvas, frames, key, label, segmentAware = false) {
    const result = prepare(canvas); if (!result) return;
    const { ctx, width, height } = result;
    const value = (f) => key === 'price' ? f.priceStatus === 'LIVE' ? f.price : null : f.flowStatus === 'LIVE' ? f.flow?.cvdBtc ?? null : null;
    const finite = frames.map(value).filter((x) => Number.isFinite(x));
    if (!finite.length) { placeholder(ctx, `${label}: no verified samples`); return; }
    const min = Math.min(...finite), max = Math.max(...finite);
    const range = Math.max(0.0001, max - min);
    const toY = (n) => 89 - (n - min) / range * 66;
    ctx.strokeStyle = color.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 90); ctx.lineTo(width, 90); ctx.stroke();
    let previous = null;
    frames.forEach((f, i) => {
      const v = value(f);
      if (v === null || !Number.isFinite(v)) { previous = null; return; }
      const x = frames.length > 1 ? 4 + (width - 8) * i / (frames.length - 1) : width / 2;
      if (previous && (f.at - previous.at !== 2_000 || (segmentAware && f.flow.segment !== previous.segment))) previous = null;
      if (previous) {
        ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(x, toY(v));
        ctx.strokeStyle = v >= previous.v ? color.green : color.red; ctx.lineWidth = 1.8; ctx.stroke();
      }
      previous = { x, y: toY(v), v, at: f.at, segment: f.flow?.segment };
    });
    ctx.font = '10px system-ui'; ctx.fillStyle = color.text;
    ctx.fillText(`${label}: ${compact.format(finite.at(-1))}`, 6, 14);
    ctx.fillText(`${compact.format(min)} – ${compact.format(max)}`, 6, 107);
  }
  function heatmap(canvas, frames, selected) {
    const result = prepare(canvas); if (!result) return;
    const { ctx, width, height } = result;
    const bucket = selected.bucketSize;
    const priceRef = selected.price ?? selected.bands?.[0]?.lower ?? [...frames].reverse().find((f) => f.price)?.price;
    if (!priceRef || !frames.some((f) => f.bands?.length)) { placeholder(ctx, 'Visible depth: no verified observations'); return; }
    const anchor = Math.floor(priceRef / bucket) * bucket;
    const min = anchor - 5 * bucket, rows = 11;
    const notional = frames.flatMap((f) => f.bands ?? []).map((b) => b.notional);
    const max = Math.max(1, ...notional);
    const colWidth = width / frames.length, rowHeight = 88 / rows;
    frames.forEach((f, i) => {
      if (f.bucketSize !== bucket || f.depthStatus !== 'LIVE' || !f.bands) return;
      for (const b of f.bands) {
        const row = Math.round((b.lower - min) / bucket);
        if (row < 0 || row >= rows) continue;
        const alpha = Math.min(0.9, 0.08 + Math.sqrt(b.notional / max) * 0.82);
        ctx.fillStyle = b.side === 'bid' ? `rgba(117,198,158,${alpha})` : `rgba(220,128,137,${alpha})`;
        ctx.fillRect(i * colWidth, 88 - (row + 1) * rowHeight, Math.max(1, colWidth), rowHeight);
      }
    });
    ctx.fillStyle = color.text; ctx.font = '10px system-ui';
    ctx.fillText(`VISIBLE DEPTH · ${compact.format(min)}–${compact.format(min + rows * bucket)} USDT`, 6, 106);
  }
  function render(recording, position, mode) {
    if (disposed || !panel) return;
    const frames = recording.frames ?? [];
    if (!frames.length) {
      status.textContent = mode === 'RECORDING' ? 'RECORDING · 0' : 'NO RECORDING';
      detail.textContent = 'Start a new observation capture, or import a local JSON recording.';
      confluence.textContent = 'No comparable observations.';
      progress.textContent = '0 / 0';
      slider.max = '0'; slider.value = '0'; slider.disabled = true;
      for (const canvas of [priceCanvas, deltaCanvas, heatmapCanvas]) { const p = prepare(canvas); if (p) placeholder(p.ctx, 'No observations'); }
      return;
    }
    const selectedIndex = Math.max(0, Math.min(frames.length - 1, position));
    const frame = frames[selectedIndex];
    status.textContent = `${mode} · ${frames.length}/${recording.capacity}`;
    slider.disabled = false; slider.max = String(frames.length - 1); slider.value = String(selectedIndex);
    progress.textContent = `${selectedIndex + 1} / ${frames.length}`;
    axis.textContent = `${formatTime(frames[0].at)} - ${formatTime(frames.at(-1).at)}`;
    detail.textContent = `${formatTime(frame.at)} · Price ${frame.price === null ? 'N/A' : compact.format(frame.price) + ' USDT'} · Depth ${frame.depthStatus} · Trades ${frame.flowStatus} · CVD ${frame.flow ? compact.format(frame.flow.cvdBtc) + ' BTC' : 'N/A'}`;
    const insight = evaluateConfluence(frames, selectedIndex);
    const divergence = evaluatePriceDeltaDivergence(frames, selectedIndex);
    confluence.textContent = `${mode.includes('IMPORTED') ? 'UNVERIFIED IMPORT · ' : ''}${insight.label} · ${insight.details}${divergence.status === 'OBSERVED' ? ` · Price/Delta: ${divergence.direction.replaceAll('_', ' ').toLowerCase()} (descriptive only)` : ''}`;
    const start = Math.max(0, selectedIndex - 119);
    const window = frames.slice(start, selectedIndex + 1);
    plotLine(priceCanvas, window, 'price', 'TRADE PRICE');
    plotLine(deltaCanvas, window, 'cvd', 'SEGMENT CVD (BTC)', true);
    heatmap(heatmapCanvas, window, frame);
  }
  return { render, dispose() { disposed = true; } };
}
