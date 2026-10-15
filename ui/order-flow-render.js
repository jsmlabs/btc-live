import { formatPrice } from '../utils/format.js';

const usd = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const btc = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const pct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const formatSigned = (value, unit, formatter) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatter.format(Math.abs(value))} ${unit}`;

/** Paints derived observations without injecting HTML or extrapolating missing data. */
export function createOrderFlowRenderer({ doc = document } = {}) {
  const byId = (id) => doc.getElementById(`dashboardFlow${id}`);
  const panel = byId('Panel');
  const status = byId('Status');
  const buy = byId('Buy');
  const sell = byId('Sell');
  const delta = byId('Delta');
  const cvd = byId('Cvd');
  const ratio = byId('Imbalance');
  const flowBar = byId('BuyBar');
  const subtitle = byId('Note');
  const canvas = byId('Canvas');
  const ctx = canvas?.getContext('2d');
  const behaviorStatus = byId('BehaviorStatus');
  const bidChange = byId('BidChange');
  const askChange = byId('AskChange');
  const zones = byId('Zones');
  const behaviorNote = byId('BehaviorNote');
  let disposed = false;
  let chartMode = 'delta';
  let lastSnapshot = null;
  let lastReady = false;
  let inspectionIndex = null;
  let inspectionFromPointer = false;
  const zoneNodes = new Map();
  const inspection = doc.createElement('p');
  inspection.className = 'flow-footnote flow-inspection';
  inspection.setAttribute('role', 'status');
  inspection.setAttribute('aria-live', 'off');
  inspection.textContent = 'Hover or focus the chart to inspect observed trade buckets.';
  canvas?.insertAdjacentElement('afterend', inspection);
  if (canvas) { canvas.tabIndex = 0; canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Escape'); }
  const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  function inspect(index) {
    const points = lastSnapshot?.points;
    if (!lastReady || !points?.length || index === null) { inspection.textContent = 'No verified trade bucket available for inspection.'; return; }
    inspectionIndex = Math.max(0, Math.min(points.length - 1, index));
    const point = points[inspectionIndex];
    const delta = point.deltaBtc;
    inspection.textContent = `${timeFormat.format(point.at)} UTC · Buy ${btc.format(point.buyBtc)} BTC · Sell ${btc.format(point.sellBtc)} BTC · Delta ${formatSigned(delta, 'BTC', btc)}`;
  }
  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    inspectionFromPointer = true;
    const count = lastSnapshot?.points?.length || 0;
    if (!count) return;
    inspect(Math.max(0, Math.min(count - 1, Math.floor((event.clientX - rect.left) / rect.width * count))));
  }
  function onPointerLeave() { inspectionFromPointer = false; inspectionIndex = null; inspection.textContent = 'Hover or focus the chart to inspect observed trade buckets.'; }
  function onKeydown(event) {
    if (event.key === 'Escape') { onPointerLeave(); return; }
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    if (!lastSnapshot?.points?.length) return;
    event.preventDefault();
    inspectionFromPointer = false;
    inspect((inspectionIndex ?? lastSnapshot.points.length - 1) + (event.key === 'ArrowRight' ? 1 : -1));
  }
  canvas?.addEventListener('pointermove', onPointerMove);
  canvas?.addEventListener('pointerleave', onPointerLeave);
  canvas?.addEventListener('keydown', onKeydown);
  canvas?.addEventListener('blur', onPointerLeave);
  const modeButtons = [...doc.querySelectorAll('[data-flow-chart-mode]')];
  const modeListeners = modeButtons.map(button => {
    const handler = () => {
      if (!['delta', 'rolling', 'cvd'].includes(button.dataset.flowChartMode)) return;
      chartMode = button.dataset.flowChartMode;
      modeButtons.forEach(node => node.setAttribute('aria-pressed', String(node.dataset.flowChartMode === chartMode)));
      if (lastSnapshot) draw(lastSnapshot, lastReady);
    };
    button.addEventListener('click', handler);
    return [button, handler];
  });

  function draw(flow, ready) {
    if (!ctx || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(160, Math.round(bounds.width || 600));
    const height = 136;
    const scale = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,.11)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    const points = flow?.points ?? [];
    if (!ready || !points.length) return;
    const rollingTotal = points.reduce((sum, p) => sum + p.deltaBtc, 0);
    let cumulative = chartMode === 'cvd' ? flow.cvdBtc - rollingTotal : 0;
    const values = points.map(point => chartMode === 'delta' ? point.deltaBtc : (cumulative += point.deltaBtc));
    const extremes = Math.max(0.001, ...values.map(Math.abs));
    const top = 17, bottom = height - 12;
    const y = value => (top + bottom) / 2 - value / extremes * (bottom - top) / 2;
    if (chartMode === 'delta') {
      const barWidth = Math.max(1, width / values.length * .68);
      values.forEach((value, i) => {
        const x = (i + .5) / values.length * width;
        const y0 = y(0), y1 = y(value);
        ctx.fillStyle = value >= 0 ? '#37b897' : '#e47782';
        ctx.fillRect(x - barWidth / 2, Math.min(y0, y1), barWidth, Math.max(1, Math.abs(y0 - y1)));
      });
    } else {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
      ctx.strokeStyle = values.at(-1) >= 0 ? '#5bcbaa' : '#f0929b';
      ctx.beginPath();
      values.forEach((value, i) => {
        const x = values.length > 1 ? i / (values.length - 1) * width : width;
        if (i === 0) ctx.moveTo(x, y(value)); else ctx.lineTo(x, y(value));
      });
      ctx.stroke();
    }
    const label = chartMode === 'cvd' ? 'Connection-relative CVD (BTC) · latest 60s view' :
      chartMode === 'rolling' ? 'Cumulative delta within 60s (BTC)' : '1s net taker delta (BTC)';
    ctx.fillStyle = 'rgba(185,196,210,.90)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(label, 6, 12);
  }

  function render(flow, behavior, enabled, depthStatus, persistence = null) {
    if (disposed || !panel) return;
    const ready = enabled && flow.status === 'LIVE' && flow.count > 0;
    panel.dataset.state = enabled ? flow.status.toLowerCase() : 'paused';
    status.textContent = enabled ? flow.status : 'PAUSED';
    status.dataset.state = ready ? 'live' : 'waiting';
    buy.textContent = ready ? `$${usd.format(flow.buyUsdt)}` : '—';
    sell.textContent = ready ? `$${usd.format(flow.sellUsdt)}` : '—';
    delta.textContent = ready ? formatSigned(flow.deltaBtc, 'BTC', btc) : '—';
    cvd.textContent = ready ? formatSigned(flow.cvdBtc, 'BTC', btc) : '—';
    ratio.textContent = ready && flow.imbalance !== null ? formatSigned(flow.imbalance, '', pct).trim() : '—';
    for (const node of [delta, cvd, ratio]) if (node) node.dataset.tone = !ready ? 'neutral' : Number(node === delta ? flow.deltaBtc : node === cvd ? flow.cvdBtc : flow.imbalance) >= 0 ? 'positive' : 'negative';
    flowBar.style.width = ready ? `${Math.max(0, Math.min(100, flow.buyBtc / (flow.buyBtc + flow.sellBtc) * 100))}%` : '50%';
    subtitle.textContent = !enabled ? 'Execution feed paused by user.' : !ready ?
      `No verified execution window · ${flow.status}${flow.status === 'RECONNECTING' ? ' (reconnecting)' : ''}` :
      `${flow.count} aggregate events / 60s · ${flow.observed} events in current segment · Window Δ ${[10000,30000,60000,300000].map(ms => { const w = flow.windows?.[String(ms)]; return `${ms/1000}s ${w?.status === 'OBSERVED' ? formatSigned(w.deltaBtc, 'BTC', btc) : '—'}`; }).join(' · ')} · partial windows suppressed after reconnect; no backfill`;
    lastSnapshot = flow;
    lastReady = ready;
    draw(flow, ready);
    if (!ready) { inspectionIndex = null; inspection.textContent = 'No verified trade bucket available for inspection.'; }
    else if (inspectionIndex !== null) inspect(inspectionIndex);

    const valid = depthStatus === 'LIVE' && behavior.status === 'LIVE';
    behaviorStatus.textContent = depthStatus !== 'LIVE' ? 'DEPTH UNAVAILABLE' : behavior.status;
    behaviorStatus.dataset.state = valid ? 'live' : 'waiting';
    bidChange.textContent = valid ? formatSigned(behavior.bidChange, 'USDT', usd) : '—';
    askChange.textContent = valid ? formatSigned(behavior.askChange, 'USDT', usd) : '—';
    // Keep stable zone nodes through successive depth observations to avoid hover loss.
    const activeKeys = new Set();
    if (valid) for (const entry of behavior.zones) {
      const key = `${entry.side}:${entry.lower}`;
      activeKeys.add(key);
      let item = zoneNodes.get(key);
      if (!item) {
        item = doc.createElement('li');
        item.className = `flow-zone flow-zone-${entry.side}`;
        item.append(doc.createElement('span'), doc.createElement('strong'));
        zoneNodes.set(key, item);
      }
      item.firstElementChild.textContent = `${entry.side.toUpperCase()} · ${formatPrice(entry.lower)} USDT`;
      item.lastElementChild.textContent = `$${usd.format(entry.notional)} · ${entry.persistence}/3 samples`;
      if (item.parentNode !== zones) zones.append(item);
    }
    for (const [key, item] of zoneNodes) if (!activeKeys.has(key)) { item.remove(); zoneNodes.delete(key); }
    behaviorNote.textContent = valid ? `${behavior.note} · Verified sample ${timeFormat.format(behavior.sampleAt)} UTC · consecutive depth observations only.${persistence?.status === 'OBSERVED' ? ` 5-sample persistent zones: ${persistence.zones.filter(z => z.consecutive === 5).length} (displayed liquidity, not orders).` : ''}` : 'Verified consecutive depth samples required. No inferred liquidation, spoofing or confirmed absorption signals.';
  }
  return { render, dispose() { disposed = true; for (const [button, handler] of modeListeners) button.removeEventListener('click', handler); canvas?.removeEventListener('pointermove', onPointerMove); canvas?.removeEventListener('pointerleave', onPointerLeave); canvas?.removeEventListener('keydown', onKeydown); canvas?.removeEventListener('blur', onPointerLeave); inspection.remove(); zoneNodes.clear(); } };
}
