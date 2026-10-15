/** Session-only, bounded observation recorder. Stores *samples*, not raw exchange events. */
export const REPLAY_FORMAT = 'btc-live-observations/v1';
export const RECORDER_STEP_MS = 2_000;
export const RECORDER_MAX_FRAMES = 240;
export const REPLAY_MAX_BYTES = 1_048_576;
const VALID_FEEDS = new Set(['LIVE', 'STALE', 'PAUSED', 'RECONNECTING', 'SYNCING', 'CONNECTING', 'IDLE', 'UNAVAILABLE']);
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const timestamp = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 8_640_000_000_000_000;

function validateFrame(frame, previousAt = -1) {
  if (!frame || !timestamp(frame.at) || frame.at <= previousAt || !Number.isInteger(frame.bucketSize) ||
      ![25,50,100,250].includes(frame.bucketSize) || !VALID_FEEDS.has(frame.depthStatus) ||
      !VALID_FEEDS.has(frame.flowStatus) || !['LIVE', 'UNAVAILABLE'].includes(frame.priceStatus)) throw new Error('Invalid recording frame');
  if (frame.price !== null && (!finite(frame.price) || frame.price <= 0 || frame.price > 1e9)) throw new Error('Invalid recorded price');
  if (frame.priceStatus !== 'LIVE' && frame.price !== null) throw new Error('Unavailable price must be null');
  if (frame.bands !== null) {
    if (frame.depthStatus !== 'LIVE' || !Array.isArray(frame.bands) || frame.bands.length > 24) throw new Error('Invalid recorded depth');
    for (const band of frame.bands) {
      if (!band || !['bid','ask'].includes(band.side) || !finite(band.lower) || band.lower <= 0 ||
          !finite(band.notional) || band.notional < 0 || band.notional > 1e15 ||
          Math.abs(band.lower / frame.bucketSize - Math.round(band.lower / frame.bucketSize)) > 1e-7) throw new Error('Invalid recorded band');
    }
  }
  if (frame.flow !== null) {
    const f = frame.flow;
    if (frame.flowStatus !== 'LIVE' || !f || !Number.isSafeInteger(f.segment) || f.segment < 0 ||
        !Number.isSafeInteger(f.count) || f.count < 0 || !finite(f.cvdBtc) ||
        !finite(f.deltaBtc) || !finite(f.buyBtc) || !finite(f.sellBtc) || f.buyBtc < 0 || f.sellBtc < 0 ||
        f.buyBtc > 1e10 || f.sellBtc > 1e10 || Math.abs(f.cvdBtc) > 1e10 || Math.abs(f.deltaBtc) > 1e10) {
      throw new Error('Invalid recorded execution flow');
    }
  }
  if (frame.depthStatus !== 'LIVE' && frame.bands !== null) throw new Error('Depth gap cannot contain values');
  if (frame.flowStatus !== 'LIVE' && frame.flow !== null) throw new Error('Flow gap cannot contain values');
  return {
    at: frame.at, bucketSize: frame.bucketSize, price: frame.price, priceStatus: frame.priceStatus,
    depthStatus: frame.depthStatus, flowStatus: frame.flowStatus,
    bands: frame.bands?.map(({ side, lower, notional }) => ({ side, lower, notional })) ?? null,
    flow: frame.flow ? { segment: frame.flow.segment, count: frame.flow.count,
      cvdBtc: frame.flow.cvdBtc, deltaBtc: frame.flow.deltaBtc,
      buyBtc: frame.flow.buyBtc, sellBtc: frame.flow.sellBtc } : null
  };
}

/** An imported recording is untrusted input and is never passed to live price alerts. */
export function parseRecording(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > REPLAY_MAX_BYTES) throw new Error('Recording exceeds size limit');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Invalid recording JSON'); }
  if (!parsed || parsed.format !== REPLAY_FORMAT || parsed.symbol !== 'BTCUSDT' ||
      parsed.stepMs !== RECORDER_STEP_MS || !Array.isArray(parsed.frames) ||
      parsed.frames.length > RECORDER_MAX_FRAMES || !parsed.frames.length) throw new Error('Unsupported recording format or size');
  let previousAt = -1;
  let priorBucket = null;
  const frames = parsed.frames.map((v) => {
    const frame = validateFrame(v, previousAt);
    if (priorBucket !== null && priorBucket !== frame.bucketSize) throw new Error('Mixed bucket widths');
    priorBucket = frame.bucketSize;
    previousAt = frame.at;
    return frame;
  });
  return { format: REPLAY_FORMAT, symbol: 'BTCUSDT', stepMs: RECORDER_STEP_MS, frames };
}

export function createMarketRecorder({ capacity = RECORDER_MAX_FRAMES, stepMs = RECORDER_STEP_MS } = {}) {
  if (!Number.isSafeInteger(capacity) || capacity < 2 || capacity > RECORDER_MAX_FRAMES || stepMs !== RECORDER_STEP_MS) {
    throw new RangeError('Invalid recorder bounds');
  }
  let frames = [];
  let status = 'IDLE';
  let lastSlot = null;
  let bucketSize = null;
  function start() { frames = []; lastSlot = null; bucketSize = null; status = 'RECORDING'; }
  function stop() { if (status === 'RECORDING') status = 'STOPPED'; }
  function reset() { frames = []; lastSlot = null; bucketSize = null; status = 'IDLE'; }
  function capture(frame) {
    if (status !== 'RECORDING') return false;
    const sanitized = validateFrame(frame, frames.at(-1)?.at ?? -1);
    const slot = Math.floor(sanitized.at / stepMs);
    if (lastSlot !== null && slot <= lastSlot) return false;
    if (bucketSize !== null && sanitized.bucketSize !== bucketSize) {
      stop(); return false; // prevent mixing price grids within one recording
    }
    bucketSize = sanitized.bucketSize;
    frames.push(sanitized);
    lastSlot = slot;
    if (frames.length >= capacity) status = 'FULL';
    return true;
  }
  function load(text) {
    const value = parseRecording(text);
    frames = value.frames;
    lastSlot = Math.floor(frames.at(-1).at / stepMs);
    bucketSize = frames[0].bucketSize;
    status = 'IMPORTED';
  }
  function snapshot() { return { status, frames: frames.map((f) => ({ ...f, bands: f.bands?.map((b) => ({ ...b })) ?? null, flow: f.flow ? { ...f.flow } : null })), capacity, stepMs }; }
  function exportJson() {
    if (!frames.length) throw new Error('No recording to export');
    return JSON.stringify({ format: REPLAY_FORMAT, symbol: 'BTCUSDT', stepMs, frames });
  }
  return { start, stop, reset, capture, load, snapshot, exportJson };
}
