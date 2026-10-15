/** Bounded, opt-in Futures event capture. Events use local receipt sequence, not an exchange-wide ordering. */
export const EVENT_FORMAT = 'btc-live-events/v2';
export const EVENT_MAX_COUNT = 2400;
export const EVENT_MAX_BYTES = 4 * 1024 * 1024;
const maxTime = 8_640_000_000_000_000;
const clock = (x) => Number.isSafeInteger(x) && x >= 0 && x <= maxTime;
const integer = (x) => Number.isSafeInteger(x) && x >= 0;
const number = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const feeds = new Set(['depth', 'trades']);
const gapStates = new Set(['PAUSED', 'RECONNECTING', 'STALE', 'CONNECTING', 'SYNCING', 'IDLE', 'UNAVAILABLE']);

function levels(input, allowZero, limit = 4000) {
  if (!Array.isArray(input) || input.length > limit) throw new Error('Invalid depth levels');
  const found = new Set();
  return input.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2 || !number(pair[0]) || pair[0] <= 0 ||
        !number(pair[1]) || (!allowZero && pair[1] === 0) || pair[1] > 1e10 || pair[0] > 1e9 ||
        found.has(pair[0])) throw new Error('Invalid or duplicate depth level');
    found.add(pair[0]);
    return [pair[0], pair[1]];
  });
}

function cleanEvent(e, expectedSeq) {
  if (!e || !integer(e.seq) || e.seq !== expectedSeq || !clock(e.at)) throw new Error('Invalid receipt sequence/time');
  const base = { seq: e.seq, at: e.at };
  if (e.kind === 'gap') {
    if (!feeds.has(e.feed) || !gapStates.has(e.status)) throw new Error('Invalid feed gap');
    return { ...base, kind: 'gap', feed: e.feed, status: e.status };
  }
  if (e.kind === 'depth.snapshot') {
    if (!integer(e.updateId)) throw new Error('Invalid depth update ID');
    const bids = levels(e.bids, false), asks = levels(e.asks, false);
    if (!bids.length || !asks.length || Math.max(...bids.map((x) => x[0])) >= Math.min(...asks.map((x) => x[0]))) throw new Error('Invalid depth snapshot spread');
    return { ...base, kind: 'depth.snapshot', updateId: e.updateId, bids, asks };
  }
  if (e.kind === 'depth.diff') {
    if (!integer(e.firstId) || !integer(e.finalId) || !integer(e.prevId) || e.finalId < e.firstId || !clock(e.eventAt) || Math.abs(e.eventAt-e.at)>15_000) throw new Error('Invalid depth diff sequence');
    return { ...base, kind: 'depth.diff', firstId: e.firstId, finalId: e.finalId, prevId: e.prevId, eventAt: e.eventAt,
      bids: levels(e.bids, true, 2000), asks: levels(e.asks, true, 2000) };
  }
  if (e.kind === 'trade') {
    if (!integer(e.id) || !integer(e.segment) || !clock(e.eventAt) || !clock(e.tradeAt) ||
        Math.abs(e.tradeAt-e.at)>15_000 || Math.abs(e.eventAt-e.at)>15_000 || !number(e.price) || e.price <= 0 || e.price > 1e9 || !number(e.quantity) ||
        e.quantity <= 0 || e.quantity > 1e10 || !['buy','sell'].includes(e.side)) throw new Error('Invalid trade');
    return { ...base, kind: 'trade', id: e.id, segment: e.segment, eventAt: e.eventAt,
      tradeAt: e.tradeAt, price: e.price, quantity: e.quantity, side: e.side };
  }
  throw new Error('Unknown event kind');
}

/** The per-feed state is replayed in receipt order; feeds have no shared exchange sequence. */
function createSequenceState() {
  return { depthId: null, bids: null, asks: null, lastSegment: -1, tradeId: null };
}
function advanceSequence(s, event) {
  if (event.kind === 'gap') {
    if (event.feed === 'depth') { s.depthId = null; s.bids = s.asks = null; }
    else s.tradeId = null;
  } else if (event.kind === 'depth.snapshot') {
    s.depthId = event.updateId;
    s.bids = new Map(event.bids); s.asks = new Map(event.asks);
  } else if (event.kind === 'depth.diff') {
    if (s.depthId === null || event.prevId !== s.depthId || event.finalId <= s.depthId) throw new Error('Depth replay sequence gap');
    for (const [target, changes] of [[s.bids, event.bids], [s.asks, event.asks]]) {
      for (const [price, qty] of changes) { if (qty === 0) target.delete(price); else target.set(price, qty); }
    }
    if (s.bids.size > 4000 || s.asks.size > 4000 || (s.bids.size && s.asks.size && Math.max(...s.bids.keys()) >= Math.min(...s.asks.keys()))) throw new Error('Invalid replay depth book');
    s.depthId = event.finalId;
  } else if (event.kind === 'trade') {
    if (event.segment < s.lastSegment || (event.segment === s.lastSegment && s.tradeId !== null && event.id <= s.tradeId)) throw new Error('Duplicate or out-of-order trade');
    if (event.segment !== s.lastSegment) { s.lastSegment = event.segment; s.tradeId = null; }
    s.tradeId = event.id;
  }
}
function validateSequence(events) {
  const state = createSequenceState();
  for (const event of events) advanceSequence(state, event);
  return state;
}

export function parseEventRecording(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > EVENT_MAX_BYTES) throw new Error('Event recording exceeds 4 MiB limit');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Invalid event JSON'); }
  if (!data || data.format !== EVENT_FORMAT || data.symbol !== 'BTCUSDT' || data.market !== 'USD-M-FUTURES' ||
      !Array.isArray(data.events) || !data.events.length || data.events.length > EVENT_MAX_COUNT) throw new Error('Unsupported event recording');
  let previousAt = -1;
  const events = data.events.map((entry, i) => {
    const e = cleanEvent(entry, i);
    if (e.at < previousAt) throw new Error('Non-monotonic receipt timestamps');
    previousAt = e.at;
    return e;
  });
  validateSequence(events);
  return { format: EVENT_FORMAT, symbol: 'BTCUSDT', market: 'USD-M-FUTURES', events };
}

export function createEventRecorder({ maxCount = EVENT_MAX_COUNT, maxBytes = EVENT_MAX_BYTES } = {}) {
  if (!integer(maxCount) || maxCount < 2 || maxCount > EVENT_MAX_COUNT || !integer(maxBytes) || maxBytes < 1000 || maxBytes > EVENT_MAX_BYTES) throw new RangeError('Invalid event recorder limits');
  let events = [], size = 0, status = 'IDLE', trustedCapture = true, sequence = createSequenceState();
  const prefix = { format: EVENT_FORMAT, symbol: 'BTCUSDT', market: 'USD-M-FUTURES' };
  function start() { events = []; size = 0; status = 'RECORDING'; trustedCapture = true; sequence = createSequenceState(); }
  function stop() { if (status === 'RECORDING') status = 'STOPPED'; }
  function clear() { events = []; size = 0; status = 'IDLE'; trustedCapture = true; sequence = createSequenceState(); }
  function append(kind, data, at = Date.now()) {
    if (status !== 'RECORDING') return false;
    let event;
    try {
      event = cleanEvent({ ...data, kind, seq: events.length, at }, events.length);
      if (events.length && event.at < events.at(-1).at) throw new Error('Non-monotonic clock');
      // Check against a disposable copy, so rejected imports/events never corrupt capture state.
      const candidate = { ...sequence, bids: sequence.bids ? new Map(sequence.bids) : null, asks: sequence.asks ? new Map(sequence.asks) : null };
      advanceSequence(candidate, event);
      sequence = candidate;
    } catch { status = 'INVALID'; return false; }
    const bytes = new TextEncoder().encode(JSON.stringify(event)).byteLength + 1;
    if (events.length >= maxCount || size + bytes > maxBytes - 120) { status = 'FULL'; return false; }
    events.push(event); size += bytes;
    if (events.length >= maxCount) status = 'FULL';
    return true;
  }
  function exportJson() {
    if (!events.length) throw new Error('No event recording to export');
    const json = JSON.stringify({ ...prefix, events });
    if (new TextEncoder().encode(json).byteLength > maxBytes) throw new Error('Recording exceeds 4 MiB limit');
    return json;
  }
  function load(text) {
    const parsed = parseEventRecording(text);
    if (parsed.events.length > maxCount || new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('Recording exceeds configured limits');
    events = parsed.events; sequence = validateSequence(events); status = 'IMPORTED'; trustedCapture = false; size = new TextEncoder().encode(text).byteLength;
  }
  function state() { return { status, count: events.length, bytes: size, trustedCapture }; }
  function snapshot() { return { status, trustedCapture, events: events.map((e) => ({...e, bids: e.bids?.map((p)=>[...p]), asks: e.asks?.map((p)=>[...p])})), bytes: size, capacity: maxCount }; }
  return { start, stop, clear, append, load, state, snapshot, exportJson };
}
