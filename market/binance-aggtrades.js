import { reconnectDelay } from '../utils/backoff.js';

/** USD-M futures taker execution stream (not resting orders or liquidations). */
export const AGG_TRADE_STREAM_URL = 'wss://fstream.binance.com/market/ws/btcusdt@aggTrade';
export const AGG_TRADE_STALE_MS = 12_000;
export const AGG_TRADE_MAX_AGE_MS = 15_000;

export function parseAggTrade(message) {
  let raw;
  try { raw = typeof message === 'string' ? JSON.parse(message) : message; } catch { return null; }
  const event = raw?.data ?? raw;
  if (event?.e !== 'aggTrade' || event.s !== 'BTCUSDT' || typeof event.m !== 'boolean' ||
      !Number.isSafeInteger(event.a) || event.a < 0 ||
      !Number.isSafeInteger(event.E) || !Number.isSafeInteger(event.T) || event.E <= 0 || event.T <= 0 ||
      (event.f !== undefined && (!Number.isSafeInteger(event.f) || event.f < 0)) ||
      (event.l !== undefined && (!Number.isSafeInteger(event.l) || event.l < (event.f ?? 0)))) return null;
  if (!['string', 'number'].includes(typeof event.p) || !['string', 'number'].includes(typeof event.q)) return null;
  const price = Number(event.p);
  const quantity = Number(event.q);
  const notional = price * quantity;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(notional) || notional <= 0 || notional > 1e15) return null;
  return {
    id: event.a, price, quantity, notional, tradeAt: event.T, eventAt: event.E,
    side: event.m ? 'sell' : 'buy' // Buyer is maker => seller is the taker.
  };
}

/** Independent dashboard-only execution feed; does not change price, alerts or order-book state. */
export function createBinanceAggTradeRuntime({
  onChange = () => {},
  socketFactory = (url) => new WebSocket(url),
  now = () => Date.now(),
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis)
} = {}) {
  let status = 'IDLE';
  let updatedAt = null;
  let error = '';
  let generation = 0;
  let socket = null;
  let enabled = false;
  let disposed = false;
  let retryTimer = null;
  let healthTimer = null;
  let connectedAt = null;
  let attempt = 0;
  let lastId = null;
  let segment = 0;
  const snapshot = () => {
    const ageMs = updatedAt === null ? null : Math.max(0, now() - updatedAt);
    const fresh = status === 'LIVE' && ageMs !== null && ageMs <= AGG_TRADE_STALE_MS;
    return { status: status === 'LIVE' && !fresh ? 'STALE' : status,
      updatedAt, ageMs, valid: fresh, error, segment };
  };
  const publish = (trade = null) => onChange(snapshot(), trade);
  const setStatus = (next, reason = '') => {
    if (status === next && error === reason) return;
    status = next;
    error = reason;
    publish();
  };
  function closeSocket() {
    generation++;
    connectedAt = null;
    const old = socket;
    socket = null;
    if (old) {
      old.onopen = old.onmessage = old.onclose = old.onerror = null;
      if (old.readyState === 0 || old.readyState === 1) old.close();
    }
  }
  function reconnect(reason) {
    if (!enabled || disposed) return;
    closeSocket();
    updatedAt = null;
    lastId = null;
    ++segment;
    setStatus('RECONNECTING', reason);
    if (retryTimer !== null) return;
    retryTimer = setTimeoutFn(() => {
      retryTimer = null;
      connect();
    }, reconnectDelay(attempt++));
  }
  function connect() {
    if (!enabled || disposed) return;
    closeSocket();
    connectedAt = now();
    setStatus('CONNECTING');
    const id = generation;
    try { socket = socketFactory(AGG_TRADE_STREAM_URL); }
    catch (cause) { reconnect(cause?.message ?? 'Trade stream could not connect'); return; }
    const current = () => id === generation && enabled && !disposed;
    socket.onopen = () => { if (current()) connectedAt = now(); };
    socket.onmessage = ({ data }) => {
      if (!current()) return;
      const trade = typeof data === 'string' && data.length <= 8192 ? parseAggTrade(data) : null;
      if (!trade) { reconnect('Invalid aggregate trade event'); return; }
      const at = now();
      if (trade.tradeAt > at + 5_000 || at - trade.tradeAt > AGG_TRADE_MAX_AGE_MS) {
        reconnect('Delayed or future trade event'); return;
      }
      if (lastId !== null && trade.id <= lastId) return; // replay/duplicate, not executed twice
      // Non-contiguous aggregate IDs are not proof of a loss; transport resets are gaps.
      lastId = trade.id;
      updatedAt = at;
      attempt = 0;
      status = 'LIVE';
      error = '';
      publish(trade);
    };
    socket.onerror = () => { if (current()) reconnect('Trade stream error'); };
    socket.onclose = () => { if (current()) reconnect('Trade stream disconnected'); };
  }
  function setEnabled(value) {
    if (disposed || enabled === Boolean(value)) return;
    enabled = Boolean(value);
    if (!enabled) {
      if (retryTimer !== null) clearTimeoutFn(retryTimer);
      if (healthTimer !== null) clearIntervalFn(healthTimer);
      retryTimer = healthTimer = null;
      closeSocket();
      lastId = null;
      updatedAt = null;
      ++segment;
      setStatus('PAUSED');
      return;
    }
    healthTimer = setIntervalFn(() => {
      if (status === 'LIVE' && updatedAt !== null && now() - updatedAt > AGG_TRADE_STALE_MS) reconnect('Execution feed stale');
      else if (status === 'CONNECTING' && connectedAt !== null && now() - connectedAt > AGG_TRADE_STALE_MS) reconnect('Execution feed timed out');
    }, 1000);
    connect();
  }
  function retryNow() {
    if (disposed || !enabled) return;
    if (retryTimer !== null) clearTimeoutFn(retryTimer);
    retryTimer = null;
    updatedAt = null;
    lastId = null;
    ++segment;
    connect();
  }
  function dispose() {
    if (disposed) return;
    setEnabled(false);
    disposed = true;
  }
  return { setEnabled, retryNow, dispose, snapshot };
}
