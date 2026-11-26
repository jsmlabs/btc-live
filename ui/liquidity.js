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

/** Fixed descending price ladder: bids round down, asks round up. */
export function deriveLiquidityRows(book, pivot, bucketSize, count = VISIBLE_PER_SIDE) {
  const empty = { rows: [], maxNotional: 0, bidNotional: 0, askNotional: 0 };
  if (!book || !Number.isFinite(pivot) || pivot <= 0 ||
      !Number.isFinite(bucketSize) || bucketSize <= 0 ||
      !Number.isInteger(count) || count < 1 || count > MAX_BANDS) return empty;
  // At an exact grid boundary the midpoint itself is the separator, not a depth row.
  const firstBid = Math.ceil(pivot / bucketSize) - 1;
  const firstAsk = Math.floor(pivot / bucketSize) + 1;
  if (!Number.isSafeInteger(firstAsk + count)) return empty;
  const byIndex = new Map();
  for (let index = firstAsk + count - 1; index >= firstAsk; index--) {
    byIndex.set(index, { price: index * bucketSize, side: 'ask', bid: null, ask: null });
  }
  for (let index = firstBid; index >= Math.max(0, firstBid - count + 1); index--) {
    byIndex.set(index, { price: index * bucketSize, side: 'bid', bid: null, ask: null });
  }
  let bidNotional = 0;
  let askNotional = 0;
  let maxNotional = 0;
  for (const [side, levels] of [['bid', book.bids], ['ask', book.asks]]) {
    for (const [price, quantity] of levels) {
      const notional = price * quantity;
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0 ||
          !Number.isFinite(notional) || (side === 'bid' ? price >= pivot : price <= pivot)) continue;
      const index = side === 'bid' ? Math.floor(price / bucketSize) : Math.ceil(price / bucketSize);
      const row = byIndex.get(index);
      if (!row || row.side !== side) continue;
      const band = row[side] ?? { btc: 0, notional: 0, levels: 0 };
      band.btc += quantity;
      band.notional += notional;
      band.levels++;
      row[side] = band;
      maxNotional = Math.max(maxNotional, band.notional);
      if (side === 'bid') bidNotional += notional;
      else askNotional += notional;
    }
  }
  if (!maxNotional) return empty;
  const rows = [...byIndex.values()];
  for (const row of rows) {
    if (row[row.side]) row[row.side].intensity = row[row.side].notional / maxNotional;
  }
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
    noteNode.textContent = fresh ? `Binance Futures · ${bucketSize} USDT bins · received ${Math.floor(age / 1000)}s ago · snapshot depth limited · 12 bins per side · bids round down, asks round up · empty rows are unobserved`
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
    // LAST is contextual, not the separator; only show it within the nearest displayed bounds.
    const nearestBid = view.rows.find((row) => row.side === 'bid');
    const nearestAsk = view.rows.findLast((row) => row.side === 'ask');
    const alignedTrade = Number.isFinite(referencePrice) && nearestBid && nearestAsk &&
      referencePrice > nearestBid.price && referencePrice < nearestAsk.price;
    markerNode.textContent = `MID ${formatPrice(pivot)}${alignedTrade ? ` · LAST ${formatPrice(referencePrice)}` : ''}`;
    emptyNode.hidden = true;
    rows.hidden = false;
    bidNode.textContent = notional(view.bidNotional);
    askNode.textContent = notional(view.askNotional);
    const seen = new Set();
    const orderedNodes = [];
    let markerUsed = false;
    for (const band of view.rows) {
      if (!markerUsed && band.side === 'bid') {
        orderedNodes.push(markerNode);
        markerUsed = true;
      }
      const key = band.price;
      seen.add(key);
      let node = liveRows.get(key);
      if (!node) { node = makeRow(); liveRows.set(key, node); }
      node.row.dataset.side = band.side;
      node.row.dataset.cluster = Math.max(band.bid?.intensity ?? 0, band.ask?.intensity ?? 0) >= .78 ? 'strong' : 'normal';
      node.price.textContent = formatPrice(band.price);
      const describe = (side) => {
        const level = band[side];
        return level ? `${side.toUpperCase()} · ${amount(level.btc)} BTC · ${notional(level.notional)} visible notional · ${Math.round(level.intensity * 100)}% relative intensity`
          : `${side.toUpperCase()} · no observed level`;
      };
      const interval = band.side === 'bid'
        ? `[${formatPrice(band.price)}, ${formatPrice(band.price + bucketSize)})`
        : `(${formatPrice(band.price - bucketSize)}, ${formatPrice(band.price)}]`;
      const details = `${interval} USDT · ${describe(band.side)} · ${Math.floor(age / 1000)}s old`;
      node.row.dataset.tooltip = details;
      node.row.setAttribute('aria-label', details);
      for (const [side, bar] of [['bid', node.leftBar], ['ask', node.rightBar]]) {
        const level = band[side];
        bar.style.width = level ? (mode === 'heatmap' ? '100%' : `${level.intensity * 100}%`) : '0%';
        bar.style.opacity = level ? String(mode === 'heatmap' ? Math.max(.12, level.intensity) : 1) : '0';
      }
      orderedNodes.push(node.row);
    }
    if (!markerUsed) orderedNodes.push(markerNode);
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
