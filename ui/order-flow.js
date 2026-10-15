/** Bounded, session-relative taker-flow observations. Neither historic CVD nor exchange-wide volume. */
export const FLOW_WINDOW_MS = 300_000;
export const FLOW_WINDOWS_MS = Object.freeze([10_000, 30_000, 60_000, 300_000]);
export const FLOW_BUCKET_MS = 1_000;
export const MAX_FLOW_BUCKETS = FLOW_WINDOW_MS / FLOW_BUCKET_MS + 2;

export function createOrderFlowAccumulator({ windowMs = FLOW_WINDOW_MS, bucketMs = FLOW_BUCKET_MS } = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs < bucketMs || windowMs > 300_000 ||
      !Number.isSafeInteger(bucketMs) || bucketMs < 100 || windowMs / bucketMs > 300) throw new RangeError('Invalid flow window');
  const buckets = new Map();
  let segment = null;
  let cvdBtc = 0;
  let observed = 0;
  let lastTradeAt = null;
  let lastReceivedAt = null;
  let lastId = null;
  let lastSlot = null;
  let firstReceivedAt = null;

  function reset(nextSegment) {
    buckets.clear();
    segment = nextSegment;
    cvdBtc = 0;
    observed = 0;
    lastTradeAt = lastReceivedAt = lastId = lastSlot = firstReceivedAt = null;
  }
  function prune(at) {
    const earliest = Math.floor((at - windowMs + bucketMs) / bucketMs);
    for (const key of buckets.keys()) if (key < earliest) buckets.delete(key);
    while (buckets.size > MAX_FLOW_BUCKETS) buckets.delete(buckets.keys().next().value);
  }
  function ingest(trade, at, nextSegment) {
    if (!Number.isSafeInteger(at) || at < 0 || !trade || !Number.isSafeInteger(trade.id) ||
        !Number.isFinite(trade.quantity) || trade.quantity <= 0 || !Number.isFinite(trade.notional) || trade.notional <= 0 ||
        !['buy','sell'].includes(trade.side)) return false;
    if (segment !== nextSegment) reset(nextSegment);
    if (lastId !== null && trade.id <= lastId) return false;
    const slot = Math.floor(at / bucketMs);
    if (lastSlot !== null && slot < lastSlot) return false;
    prune(at);
    const bucket = buckets.get(slot) ?? { slot, buyBtc: 0, sellBtc: 0, buyUsdt: 0, sellUsdt: 0, count: 0 };
    bucket[trade.side === 'buy' ? 'buyBtc' : 'sellBtc'] += trade.quantity;
    bucket[trade.side === 'buy' ? 'buyUsdt' : 'sellUsdt'] += trade.notional;
    bucket.count++;
    buckets.set(slot, bucket);
    if (firstReceivedAt === null) firstReceivedAt = at;
    cvdBtc += trade.side === 'buy' ? trade.quantity : -trade.quantity;
    observed++;
    lastId = trade.id;
    lastTradeAt = trade.tradeAt;
    lastReceivedAt = at;
    lastSlot = slot;
    return true;
  }
  function snapshot(at, status = 'IDLE') {
    if (!Number.isSafeInteger(at) || at < 0) throw new RangeError('Invalid snapshot time');
    prune(at);
    const from = Math.floor((at - Math.min(windowMs, 60_000) + bucketMs) / bucketMs);
    const to = Math.floor(at / bucketMs);
    const points = [];
    let buyBtc = 0, sellBtc = 0, buyUsdt = 0, sellUsdt = 0, count = 0;
    for (let i = from; i <= to; i++) {
      const value = buckets.get(i);
      const b = value?.buyBtc ?? 0;
      const s = value?.sellBtc ?? 0;
      buyBtc += b;
      sellBtc += s;
      buyUsdt += value?.buyUsdt ?? 0;
      sellUsdt += value?.sellUsdt ?? 0;
      count += value?.count ?? 0;
      points.push({ at: i * bucketMs, buyBtc: b, sellBtc: s, deltaBtc: b - s });
    }
    const windows = Object.fromEntries(FLOW_WINDOWS_MS.filter(ms => ms <= windowMs).map(ms => {
      const begin = at - ms + bucketMs;
      let wBuy = 0, wSell = 0, events = 0;
      for (const [slot, value] of buckets) {
        const bucketAt = slot * bucketMs;
        if (bucketAt < begin || bucketAt > at) continue;
        wBuy += value.buyBtc; wSell += value.sellBtc; events += value.count;
      }
      // No fabricated full-window confidence immediately after reconnect/reset.
      const complete = status === 'LIVE' && firstReceivedAt !== null && at - firstReceivedAt >= ms &&
        lastReceivedAt !== null && at >= lastReceivedAt && at - lastReceivedAt <= 3_000;
      return [String(ms), { status: complete ? 'OBSERVED' : 'UNAVAILABLE',
        deltaBtc: complete ? wBuy - wSell : null, buyBtc: complete ? wBuy : null,
        sellBtc: complete ? wSell : null, count: complete ? events : null }];
    }));
    const denominator = buyBtc + sellBtc;
    return {
      status, segment, cvdBtc, observed, lastTradeAt, lastReceivedAt, count,
      buyBtc, sellBtc, buyUsdt, sellUsdt, deltaBtc: buyBtc - sellBtc,
      windows, imbalance: denominator > 0 ? (buyBtc - sellBtc) / denominator : null,
      points
    };
  }
  return { ingest, reset, snapshot };
}
