import { deriveLiquidityBands } from './liquidity.js';

export const HISTORY_STEP_MS = 2_000;
export const HISTORY_SAMPLES = 120;
export const HISTORY_LEVELS_PER_SIDE = 12;

/** Rolling, session-local *observations* of verified visible resting depth.
 * Gaps are explicit and never interpreted as a zero-liquidity observation.
 */
export function createDepthHistory({ stepMs = HISTORY_STEP_MS, capacity = HISTORY_SAMPLES } = {}) {
  if (!Number.isSafeInteger(stepMs) || stepMs < 100 || !Number.isSafeInteger(capacity) || capacity < 2 || capacity > 600) {
    throw new RangeError('Invalid depth history bounds');
  }
  const samples = [];
  let lastSlot = null;
  let lastBucket = null;

  function clear() {
    samples.length = 0;
    lastSlot = null;
  }
  function push(sample) {
    samples.push(sample);
    if (samples.length > capacity) samples.splice(0, samples.length - capacity);
  }
  function gap(at) {
    if (!Number.isSafeInteger(at) || at < 0) return false;
    const slot = Math.floor(at / stepMs);
    if (lastSlot === null || slot <= lastSlot) return false;
    // Bound gap materialization even after hours of suspension.
    const start = Math.max(lastSlot + 1, slot - capacity + 1);
    for (let i = start; i <= slot; i++) push({ at: i * stepMs, bands: null });
    lastSlot = slot;
    return true;
  }
  function ingest({ status, book, updatedAt }, bucketSize, at) {
    if (!Number.isSafeInteger(at) || at < 0) return false;
    if (!Number.isFinite(bucketSize) || bucketSize <= 0) return false;
    if (lastBucket !== null && lastBucket !== bucketSize) clear();
    lastBucket = bucketSize;
    const slot = Math.floor(at / stepMs);
    if (status !== 'LIVE' || !book || updatedAt === null || at - updatedAt > 6_000 || at < updatedAt) {
      return gap(at);
    }
    if (lastSlot !== null && slot <= lastSlot) return false;
    const bid = book.bids?.size ? Math.max(...book.bids.keys()) : NaN;
    const ask = book.asks?.size ? Math.min(...book.asks.keys()) : NaN;
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid >= ask) return gap(at);
    const view = deriveLiquidityBands(book, (bid + ask) / 2, bucketSize, HISTORY_LEVELS_PER_SIDE);
    if (!view.bands.length) return gap(at);
    if (lastSlot !== null && slot > lastSlot + 1) {
      const start = Math.max(lastSlot + 1, slot - capacity + 1);
      for (let i = start; i < slot; i++) push({ at: i * stepMs, bands: null });
    }
    push({ at: slot * stepMs, bands: view.bands.map(({ side, lower, notional }) => ({ side, lower, notional })) });
    lastSlot = slot;
    return true;
  }
  return {
    ingest, gap, clear,
    snapshot() { return { stepMs, capacity, bucketSize: lastBucket, samples: samples.slice() }; }
  };
}
