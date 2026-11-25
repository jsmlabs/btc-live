import { formatPrice } from '../utils/format.js';

const VISIBLE_PER_SIDE = 12;
const MAX_BANDS = 32;

/** Aggregate displayed *visible* resting quantities; no liquidation estimates. */
export function deriveLiquidityBands(book, referencePrice, bucketSize, count = VISIBLE_PER_SIDE) {
  if (!book || !Number.isFinite(referencePrice) || referencePrice <= 0 ||
      !Number.isFinite(bucketSize) || bucketSize <= 0 || !Number.isInteger(count) || count < 1 || count > MAX_BANDS) {
    return { bands: [], maxNotional: 0, bidNotional: 0, askNotional: 0 };
  }
  const result = [];
  for (const [side, levels] of [['bid', book.bids], ['ask', book.asks]]) {
    const bins = new Map();
    for (const [price, quantity] of levels) {
      // Ignore crossed/outdated and zero book levels. Never treat missing depth as zero-volume evidence.
      if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0 ||
          (side === 'bid' ? price >= referencePrice : price <= referencePrice)) continue;
      const index = Math.floor(price / bucketSize);
      const band = bins.get(index) ?? { side, lower: index * bucketSize, upper: (index + 1) * bucketSize, btc: 0, notional: 0, levels: 0 };
      band.btc += quantity;
      band.notional += price * quantity;
      band.levels++;
      bins.set(index, band);
    }
    const nearest = [...bins.values()].sort((a, b) => side === 'bid' ? b.lower - a.lower : a.lower - b.lower).slice(0, count);
    result.push(...nearest);
  }
  const maxNotional = Math.max(0, ...result.map((band) => band.notional));
  return {
    bands: result.sort((a, b) => b.lower - a.lower).map((band) => ({
      ...band, intensity: maxNotional > 0 ? band.notional / maxNotional : 0
    })),
    maxNotional,
    bidNotional: result.filter((band) => band.side === 'bid').reduce((sum, band) => sum + band.notional, 0),
    askNotional: result.filter((band) => band.side === 'ask').reduce((sum, band) => sum + band.notional, 0)
  };
}

/** A fixed, descending ladder of half-open price bins; absent sides are unobserved. */
export function deriveLiquidityRows(book, pivot, bucketSize, count = VISIBLE_PER_SIDE) {
  const empty = { rows: [], maxNotional: 0, bidNotional: 0, askNotional: 0 };
  if (!book || !Number.isFinite(pivot) || pivot <= 0 ||
      !Number.isFinite(bucketSize) || bucketSize <= 0 ||
      !Number.isInteger(count) || count < 1 || count >= MAX_BANDS) return empty;
  const center = Math.floor(pivot / bucketSize);
  if (!Number.isSafeInteger(center + count)) return empty;
  // Include the center bin in addition to the requested number on either side.
  const { bands } = deriveLiquidityBands(book, pivot, bucketSize, count + 1);
  if (!bands.length) return empty;
  const byIndex = new Map();
  for (let index = center + count; index >= Math.max(0, center - count); index--) {
    byIndex.set(index, { lower: index * bucketSize, upper: (index + 1) * bucketSize,
      containsPivot: index === center, bid: null, ask: null });
  }
  let bidNotional = 0;
  let askNotional = 0;
  let maxNotional = 0;
  for (const band of bands) {
    const row = byIndex.get(Math.round(band.lower / bucketSize));
    if (!row) continue;
    row[band.side] = band;
    maxNotional = Math.max(maxNotional, band.notional);
    if (band.side === 'bid') bidNotional += band.notional;
    else askNotional += band.notional;
  }
  if (!maxNotional) return empty;
  const rows = [...byIndex.values()].map((row) => ({
    ...row,
    bid: row.bid && { ...row.bid, intensity: row.bid.notional / maxNotional },
    ask: row.ask && { ...row.ask, intensity: row.ask.notional / maxNotional }
  }));
  return { rows, maxNotional, bidNotional, askNotional };
}

function amount(value) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value); }
function notional(value) {
  return value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(1)}K` : `$${amount(value)}`;
}

export function createLiquidityRenderer({ doc = document } = {}) {
  const panel = doc.getElementById('dashboardLiquidityPanel');
  const rows = doc.getElementById('dashboardLiquidityRows');
  const statusNode = doc.getElementById('dashboardLiquidityStatus');
  const noteNode = doc.getElementById('dashboardLiquidityNote');
  const bidNode = doc.getElementById('dashboardLiquidityBids');
  const askNode = doc.getElementById('dashboardLiquidityAsks');
  const markerNode = doc.getElementById('dashboardLiquidityMarker');
  const emptyNode = doc.getElementById('dashboardLiquidityEmpty');
  const liveRows = new Map();

  function makeRow() {
    const row = doc.createElement('div');
    row.className = 'liquidity-row';
    row.tabIndex = 0;
    const left = doc.createElement('div');
    left.className = 'liquidity-side liquidity-bid';
    const leftBar = doc.createElement('span');
    leftBar.className = 'liquidity-bar';
    left.append(leftBar);
    const price = doc.createElement('span');
    price.className = 'liquidity-price';
    const right = doc.createElement('div');
    right.className = 'liquidity-side liquidity-ask';
    const rightBar = doc.createElement('span');
    rightBar.className = 'liquidity-bar';
    right.append(rightBar);
    row.append(left, price, right);
    return { row, price, leftBar, rightBar };
  }

  function render(snapshot, preferences, referencePrice, now = Date.now()) {
    const { enabled, bucketSize, mode } = preferences;
    const age = snapshot.updatedAt === null ? null : Math.max(0, now - snapshot.updatedAt);
    const fresh = enabled && snapshot.status === 'LIVE' && age !== null && age <= 6_000;
    const state = !enabled ? 'PAUSED' : !fresh && snapshot.status === 'LIVE' ? 'STALE' : snapshot.status;
    statusNode.textContent = state;
    statusNode.dataset.state = state.toLowerCase();
    panel.dataset.liquidityMode = mode;
    markerNode.textContent = 'REFERENCE —';
    noteNode.textContent = fresh ? `Binance Futures · ${bucketSize} USDT bins · received ${Math.floor(age / 1000)}s ago · snapshot depth limited · fixed ±12 bins around midpoint · empty sides are unobserved`
      : !enabled ? 'Liquidity feed paused locally.' : snapshot.error || (state === 'STALE' ? 'Depth updates delayed. Data hidden.' : 'Synchronizing Binance order book…');
    if (!fresh || !snapshot.book) {
      emptyNode.hidden = false;
      rows.hidden = true;
      emptyNode.textContent = state === 'PAUSED' ? 'Enable liquidity to stream order book depth.' :
        state === 'RECONNECTING' || state === 'STALE' ? 'Order book unavailable. Resynchronizing…' :
        'Waiting for synchronized depth data…';
      bidNode.textContent = askNode.textContent = '—';
      return;
    }
    const topBid = Math.max(...snapshot.book.bids.keys());
    const topAsk = Math.min(...snapshot.book.asks.keys());
    const pivot = Number.isFinite(topBid) && Number.isFinite(topAsk) && topBid > 0 && topBid < topAsk
      ? (topBid + topAsk) / 2 : null;
    // Depth and trade streams are not atomic. Anchor the ladder to depth's own midpoint.
    const view = deriveLiquidityRows(snapshot.book, pivot, bucketSize);
    if (!view.rows.length) {
      emptyNode.hidden = false;
      rows.hidden = true;
      emptyNode.textContent = 'No verified visible depth in this price range.';
      bidNode.textContent = askNode.textContent = '—';
      return;
    }
    const center = view.rows.find((row) => row.containsPivot);
    const alignedTrade = Number.isFinite(referencePrice) &&
      referencePrice >= center.lower && referencePrice < center.upper;
    markerNode.textContent = `MID ${formatPrice(pivot)}${alignedTrade ? ` · LAST ${formatPrice(referencePrice)}` : ''} · IN BIN BELOW`;
    emptyNode.hidden = true;
    rows.hidden = false;
    bidNode.textContent = notional(view.bidNotional);
    askNode.textContent = notional(view.askNotional);
    const seen = new Set();
    const orderedNodes = [];
    for (const band of view.rows) {
      if (band.containsPivot) orderedNodes.push(markerNode);
      const key = band.lower;
      seen.add(key);
      let node = liveRows.get(key);
      if (!node) { node = makeRow(); liveRows.set(key, node); }
      node.row.dataset.side = band.bid && band.ask ? 'both' : band.bid ? 'bid' : band.ask ? 'ask' : 'unobserved';
      node.row.dataset.cluster = Math.max(band.bid?.intensity ?? 0, band.ask?.intensity ?? 0) >= .78 ? 'strong' : 'normal';
      node.price.textContent = formatPrice(band.lower);
      const describe = (side) => {
        const level = band[side];
        return level ? `${side.toUpperCase()} · ${amount(level.btc)} BTC · ${notional(level.notional)} visible notional · ${Math.round(level.intensity * 100)}% relative intensity`
          : `${side.toUpperCase()} · no observed level`;
      };
      const details = `[${formatPrice(band.lower)}, ${formatPrice(band.upper)}) USDT · ${describe('bid')} · ${describe('ask')} · ${Math.floor(age / 1000)}s old`;
      node.row.title = details;
      node.row.setAttribute('aria-label', details);
      for (const [side, bar] of [['bid', node.leftBar], ['ask', node.rightBar]]) {
        const level = band[side];
        bar.style.width = level ? (mode === 'heatmap' ? '100%' : `${level.intensity * 100}%`) : '0%';
        bar.style.opacity = level ? String(mode === 'heatmap' ? Math.max(.12, level.intensity) : 1) : '0';
      }
      orderedNodes.push(node.row);
    }
    // Re-appending an existing hovered row detaches it and generates a synthetic
    // pointerleave/pointerenter sequence. Reorder only when the actual order changes.
    for (let index = 0; index < orderedNodes.length; index++) {
      const wanted = orderedNodes[index];
      if (rows.children[index] !== wanted) rows.insertBefore(wanted, rows.children[index] ?? null);
    }
    for (const [key, node] of liveRows) {
      if (!seen.has(key)) { node.row.remove(); liveRows.delete(key); }
    }
  }

  return { render, dispose() { liveRows.clear(); rows.replaceChildren(markerNode); } };
}
