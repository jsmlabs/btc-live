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

  function makeRow(band) {
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
    noteNode.textContent = fresh ? `Binance Futures · ${bucketSize} USDT bins · received ${Math.floor(age / 1000)}s ago · snapshot depth limited`
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
    const bookMidpoint = Number.isFinite(topBid) && Number.isFinite(topAsk) && topBid < topAsk
      ? (topBid + topAsk) / 2 : null;
    // The trade stream and depth stream are not atomic. Cluster positioning uses depth's own midpoint.
    const alignedTrade = bookMidpoint !== null && Number.isFinite(referencePrice) &&
      Math.abs(referencePrice - bookMidpoint) <= bucketSize;
    const pivot = bookMidpoint ?? referencePrice;
    markerNode.textContent = !Number.isFinite(pivot) ? 'REFERENCE —' :
      `${alignedTrade ? 'LAST' : 'MID'} ${formatPrice(alignedTrade ? referencePrice : pivot)}`;
    const view = deriveLiquidityBands(snapshot.book, pivot, bucketSize);
    if (!view.bands.length) {
      emptyNode.hidden = false;
      rows.hidden = true;
      emptyNode.textContent = 'No verified visible depth in this price range.';
      bidNode.textContent = askNode.textContent = '—';
      return;
    }
    emptyNode.hidden = true;
    rows.hidden = false;
    bidNode.textContent = notional(view.bidNotional);
    askNode.textContent = notional(view.askNotional);
    const seen = new Set();
    let previous = null;
    let markerUsed = false;
    const orderedNodes = [];
    for (const band of view.bands) {
      if (!markerUsed && band.side === 'bid' && previous?.side === 'ask') {
        orderedNodes.push(markerNode);
        markerUsed = true;
      }
      const key = `${band.side}:${band.lower}`;
      seen.add(key);
      let node = liveRows.get(key);
      if (!node) { node = makeRow(band); liveRows.set(key, node); }
      node.row.dataset.side = band.side;
      node.row.dataset.cluster = band.intensity >= .78 ? 'strong' : 'normal';
      node.price.textContent = formatPrice(band.lower);
      const details = `${band.side.toUpperCase()} · ${formatPrice(band.lower)} to ${formatPrice(band.upper)} USDT · ${amount(band.btc)} BTC · ${notional(band.notional)} visible notional · ${Math.round(band.intensity * 100)}% relative intensity · ${Math.floor(age / 1000)}s old`;
      node.row.title = details;
      node.row.setAttribute('aria-label', details);
      const width = mode === 'heatmap' ? '100%' : `${Math.max(0, band.intensity * 100)}%`;
      node.leftBar.style.width = band.side === 'bid' ? width : '0%';
      node.rightBar.style.width = band.side === 'ask' ? width : '0%';
      node.leftBar.style.opacity = band.side === 'bid' ? String(mode === 'heatmap' ? Math.max(.12, band.intensity) : 1) : '0';
      node.rightBar.style.opacity = band.side === 'ask' ? String(mode === 'heatmap' ? Math.max(.12, band.intensity) : 1) : '0';
      orderedNodes.push(node.row);
      previous = band;
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
