import { formatPrice } from '../utils/format.js';

const PLOT_PAD = 5;
const PRICE_LABEL_WIDTH = 85;
const VISIBLE_ROWS_PER_SIDE = 12;
const BAR_HEIGHT = 12;
const PRICE_ROW_COUNT = 2 * VISIBLE_ROWS_PER_SIDE;
const CHART_HEIGHT = PRICE_ROW_COUNT * BAR_HEIGHT + 2 * PLOT_PAD;

const fmtTime = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmtUsd = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, notation: 'compact' });

/** Data-to-pixel transforms are exposed for deterministic regression checks. */
export function historyPriceRows(midpoint, bucketSize) {
  if (!Number.isFinite(midpoint) || midpoint <= 0 || !Number.isFinite(bucketSize) || bucketSize <= 0) return [];
  const split = Math.floor(midpoint / bucketSize);
  return Array.from({ length: PRICE_ROW_COUNT }, (_, row) => {
    const index = row < VISIBLE_ROWS_PER_SIDE ? split + (VISIBLE_ROWS_PER_SIDE - 1 - row) : split - 1 - (row - VISIBLE_ROWS_PER_SIDE);
    return { lower: index * bucketSize, side: row < VISIBLE_ROWS_PER_SIDE ? 'ask' : 'bid' };
  });
}

export function historyPlotModel(history, midpoint, bucketSize) {
  const rows = historyPriceRows(midpoint, bucketSize);
  const columns = Array.from({ length: history.capacity }, () => null);
  const entries = history.samples ?? [];
  const lastSlot = entries.length ? Math.floor(entries[entries.length - 1].at / history.stepMs) : null;
  for (const entry of entries) {
    const index = history.capacity - 1 - (lastSlot - Math.floor(entry.at / history.stepMs));
    if (index >= 0 && index < history.capacity) columns[index] = entry;
  }
  let maxNotional = 0;
  const cells = columns.map((sample) => {
    if (!sample?.bands) return null;
    const lookup = new Map(sample.bands.map((band) => [`${band.side}:${band.lower}`, band.notional]));
    return rows.map(({ side, lower }) => {
      const value = lookup.get(`${side}:${lower}`) ?? null;
      if (value !== null && value > maxNotional) maxNotional = value;
      return value;
    });
  });
  return { rows, columns, cells, maxNotional, lastAt: entries.at(-1)?.at ?? null };
}

export function createLiquidityHistoryRenderer({ doc = document } = {}) {
  const chart = doc.getElementById('dashboardLiquidityHistoryCanvas');
  const status = doc.getElementById('dashboardLiquidityHistoryStatus');
  const tooltip = doc.getElementById('dashboardLiquidityHistoryTooltip');
  const legend = doc.getElementById('dashboardLiquidityHistoryLegend');
  const inspect = doc.getElementById('dashboardLiquidityHistoryInspect');
  const timeAxis = doc.getElementById('dashboardLiquidityHistoryAxis');
  const context = chart?.getContext('2d');
  let activeModel = null;
  let activeWidth = 0;
  let activePlotWidth = 0;
  let disposed = false;
  let cursorRow = VISIBLE_ROWS_PER_SIDE - 1;
  let cursorColumn = null;
  let pointerPosition = null;

  function hideTooltip() { tooltip.hidden = true; }
  function leavePointer() { pointerPosition = null; hideTooltip(); }
  function render(history, marketSnapshot, enabled, now = Date.now()) {
    if (!context || disposed) return;
    const { samples, bucketSize, capacity, stepMs } = history;
    const latest = samples.at(-1);
    const latestValid = [...samples].reverse().find((entry) => entry.bands?.length);
    const bid = marketSnapshot?.book?.bids?.size ? Math.max(...marketSnapshot.book.bids.keys()) : NaN;
    const ask = marketSnapshot?.book?.asks?.size ? Math.min(...marketSnapshot.book.asks.keys()) : NaN;
    const live = enabled && marketSnapshot.status === 'LIVE' && marketSnapshot.updatedAt !== null &&
      now >= marketSnapshot.updatedAt && now - marketSnapshot.updatedAt <= 6_000 && bid < ask;
    const price = live ? (bid + ask) / 2 : latestValid?.bands?.length ? (() => {
      // Frozen historical viewport after disconnection is explicitly marked as historical.
      const lowAsk = Math.min(...latestValid.bands.filter((b) => b.side === 'ask').map((b) => b.lower));
      const highBid = Math.max(...latestValid.bands.filter((b) => b.side === 'bid').map((b) => b.lower));
      return Number.isFinite(lowAsk) && Number.isFinite(highBid) ? (lowAsk + highBid + bucketSize) / 2 : NaN;
    })() : NaN;
    const width = Math.max(1, Math.floor(chart.getBoundingClientRect().width || chart.clientWidth || 1));
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    chart.width = Math.round(width * dpr);
    chart.height = Math.round(CHART_HEIGHT * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, CHART_HEIGHT);
    const model = historyPlotModel({ samples, bucketSize, capacity, stepMs }, price, bucketSize);
    const plotWidth = Math.max(1, width - PRICE_LABEL_WIDTH - PLOT_PAD * 2);
    const columnWidth = plotWidth / capacity;
    // Anchor time labels to sampled timestamps, never to assumed continuous history.
    if (timeAxis) {
      const ticks = [0, .25, .5, .75, 1].map(fraction => {
        const index = Math.min(capacity - 1, Math.floor(fraction * (capacity - 1)));
        const sample = model.columns[index];
        return sample && Number.isFinite(sample.at) ? fmtTime.format(sample.at) : '—';
      });
      [...timeAxis.children].forEach((node, index) => { if (index < ticks.length) node.textContent = ticks[index]; });
    }
    activeModel = model;
    activeWidth = width;
    activePlotWidth = plotWidth;
    const xOffset = PLOT_PAD;
    context.font = '10px system-ui, sans-serif';
    context.textAlign = 'right';
    for (let i = 0; i < model.rows.length; i++) {
      const { lower, side } = model.rows[i];
      const y = PLOT_PAD + i * BAR_HEIGHT;
      if (i === VISIBLE_ROWS_PER_SIDE) {
        context.fillStyle = 'rgba(243,162,58,.55)';
        context.fillRect(xOffset, y - 1, plotWidth, 1);
      }
      if (i % 3 === 0 || i === VISIBLE_ROWS_PER_SIDE || i === VISIBLE_ROWS_PER_SIDE - 1) {
        context.fillStyle = '#9aa9b7';
        context.fillText(formatPrice(lower), width - 4, y + 10);
      }
      context.fillStyle = side === 'bid' ? 'rgba(117,198,158,.035)' : 'rgba(220,128,137,.035)';
      context.fillRect(xOffset, y, plotWidth, BAR_HEIGHT - 1);
    }
    for (let column = 0; column < model.cells.length; column++) {
      const sample = model.columns[column];
      const x = xOffset + column * columnWidth;
      if (!sample || !sample.bands) {
        // Gaps are deliberately not painted as 0-liquidity cells.
        if (sample && !sample.bands) {
          context.fillStyle = 'rgba(142,157,169,.08)';
          context.fillRect(x, PLOT_PAD, Math.max(.5, columnWidth - .5), BAR_HEIGHT * PRICE_ROW_COUNT);
        }
        continue;
      }
      const values = model.cells[column];
      for (let row = 0; row < values.length; row++) {
        const amount = values[row];
        if (!(amount > 0)) continue;
        const intensity = Math.sqrt(amount / model.maxNotional);
        const alpha = Math.min(.94, .12 + .8 * intensity);
        const { side } = model.rows[row];
        context.fillStyle = side === 'bid' ? `rgba(97,203,153,${alpha})` : `rgba(246,111,124,${alpha})`;
        context.fillRect(x, PLOT_PAD + row * BAR_HEIGHT + 1, Math.max(.5, columnWidth - .25), BAR_HEIGHT - 2);
      }
    }
    if (!samples.length) status.textContent = 'Recording begins when verified live depth arrives';
    else if (!live) status.textContent = `${enabled ? 'HISTORICAL · depth unavailable' : 'PAUSED'} · ${samples.filter((entry) => entry.bands).length} verified samples`;
    else status.textContent = `LIVE · ${samples.filter((entry) => entry.bands).length} verified samples · latest ${fmtTime.format(latest.at)}`;
    legend.textContent = `Rolling ${capacity * stepMs / 60_000} min · ${stepMs / 1000}s observations · intensity relative to visible maximum · gaps are not zero`;
    // Keep a live hover stable across redraws, but revalidate it against the
    // refreshed time/price model rather than displaying stale market details.
    if (pointerPosition) inspectPointer(pointerPosition.x, pointerPosition.y);
    else if (doc.activeElement === chart && cursorColumn !== null) showDetails(cursorColumn, cursorRow, PLOT_PAD + (cursorColumn + .5) * columnWidth, PLOT_PAD + (cursorRow + .5) * BAR_HEIGHT, true);
    else if (doc.activeElement !== chart) hideTooltip();
  }

  function detailsFor(index, row) {
    const sample = activeModel?.columns?.[index];
    const band = activeModel?.rows?.[row];
    if (!sample || !band) return null;
    const value = activeModel.cells[index]?.[row];
    return !sample.bands ? `${fmtTime.format(sample.at)} · depth unavailable` :
      `${fmtTime.format(sample.at)} · ${band.side.toUpperCase()} ${formatPrice(band.lower)} USDT · ${value === null ? 'no observed level' : '$' + fmtUsd.format(value) + ' visible notional'}`;
  }

  function showDetails(index, row, x, y, keyboard = false) {
    const details = detailsFor(index, row);
    if (!details) return hideTooltip();
    tooltip.textContent = details;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(0, Math.min(Math.max(0, activeWidth - Math.min(220, activeWidth)), x + 8))}px`;
    const tooltipHeight = tooltip.offsetHeight || 44;
    tooltip.style.top = `${Math.max(0, Math.min(CHART_HEIGHT - tooltipHeight, y - tooltipHeight - 8))}px`;
    if (keyboard) inspect.textContent = details;
  }

  function inspectPointer(x, y) {
    if (!activeModel?.rows.length || !activePlotWidth) return hideTooltip();
    if (x < 0 || x >= activePlotWidth || y < 0 || y >= BAR_HEIGHT * PRICE_ROW_COUNT) return hideTooltip();
    const index = Math.min(activeModel.columns.length - 1, Math.floor(x / activePlotWidth * activeModel.columns.length));
    const row = Math.floor(y / BAR_HEIGHT);
    showDetails(index, row, x, y);
  }

  function handlePointer(event) {
    const rect = chart.getBoundingClientRect();
    pointerPosition = { x: event.clientX - rect.left - PLOT_PAD, y: event.clientY - rect.top - PLOT_PAD };
    inspectPointer(pointerPosition.x, pointerPosition.y);
  }

  function handleKeys(event) {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (event.key === 'Escape') { pointerPosition = null; hideTooltip(); return; }
    if (!delta || !activeModel?.rows.length) return;
    event.preventDefault();
    cursorColumn ??= activeModel.columns.length - 1;
    cursorColumn = Math.max(0, Math.min(activeModel.columns.length - 1, cursorColumn + delta[0]));
    cursorRow = Math.max(0, Math.min(activeModel.rows.length - 1, cursorRow + delta[1]));
    const x = PLOT_PAD + (cursorColumn + .5) * activePlotWidth / activeModel.columns.length;
    const y = PLOT_PAD + (cursorRow + .5) * BAR_HEIGHT;
    showDetails(cursorColumn, cursorRow, x, y, true);
  }
  chart?.addEventListener('pointermove', handlePointer);
  chart?.addEventListener('pointerleave', leavePointer);
  chart?.addEventListener('keydown', handleKeys);
  chart?.addEventListener('blur', hideTooltip);
  return { render, dispose() {
    disposed = true;
    chart?.removeEventListener('pointermove', handlePointer);
    chart?.removeEventListener('pointerleave', leavePointer);
    chart?.removeEventListener('keydown', handleKeys);
    chart?.removeEventListener('blur', hideTooltip);
    leavePointer();
  } };
}
