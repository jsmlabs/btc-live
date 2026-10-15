import { normalizeBookTickerEvent, normalizeTickerEvent, normalizeTradeEvent } from './validators.js';
import { reconnectDelay } from '../utils/backoff.js';

export const MARKET_STREAM_URL = 'wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade/btcusdt@ticker';
export const PUBLIC_STREAM_URL = 'wss://fstream.binance.com/public/stream?streams=btcusdt@bookTicker';

export function parseCombinedMessage(rawMessage, now = Date.now()) {
  // Bound untrusted frames before invoking JSON.parse on the UI thread.
  if (typeof rawMessage === 'string' && rawMessage.length > 65_536) return null;
  let envelope;
  try {
    envelope = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
  } catch {
    return null;
  }

  const payload = envelope?.data;
  if (!payload) return null;

  if (payload.e === 'aggTrade') {
    const value = normalizeTradeEvent(payload, now);
    return value ? { type: 'trade', value } : null;
  }
  if (payload.e === '24hrTicker') {
    const value = normalizeTickerEvent(payload, now);
    return value ? { type: 'ticker', value } : null;
  }
  if (payload.e === 'bookTicker') {
    const value = normalizeBookTickerEvent(payload, now);
    return value ? { type: 'bookTicker', value } : null;
  }
  return null;
}

// Each Futures endpoint reconnects independently. The runtime receives market
// connection changes, but a public book-ticker outage never tears down prices.
export function createBinanceSocket({
  onTrade, onTicker, onBookTicker, onOpen, onClose, onError, onFeedStatus,
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis)
}) {
  let disposed = false;
  const feeds = {
    market: { url: MARKET_STREAM_URL, socket: null, generation: 0, attempt: 0, timer: null, open: false },
    book: { url: PUBLIC_STREAM_URL, socket: null, generation: 0, attempt: 0, timer: null, open: false }
  };

  const report = (name, status) => onFeedStatus?.(name, status);

  const openFeed = (name) => {
    const feed = feeds[name];
    if (disposed) return;
    const generation = ++feed.generation;
    feed.open = false;
    report(name, 'CONNECTING');
    let socket;
    try {
      socket = new WebSocket(feed.url);
    } catch (error) {
      onError?.(error, name);
      scheduleFeedRecovery(name);
      return;
    }
    feed.socket = socket;
    const current = () => !disposed && feed.generation === generation && feed.socket === socket;

    socket.addEventListener('open', () => {
      if (!current()) return;
      feed.open = true;
      feed.attempt = 0;
      report(name, 'LIVE');
      if (name === 'market') onOpen?.();
    });
    socket.addEventListener('message', (event) => {
      if (!current()) return;
      const parsed = parseCombinedMessage(event.data);
      if (!parsed) return;
      if (name === 'market' && parsed.type === 'trade') onTrade?.(parsed.value);
      if (name === 'market' && parsed.type === 'ticker') onTicker?.(parsed.value);
      if (name === 'book' && parsed.type === 'bookTicker') onBookTicker?.(parsed.value);
    });
    socket.addEventListener('close', (event) => {
      if (!current()) return;
      feed.open = false;
      feed.socket = null;
      if (name === 'market') onClose?.(event);
      scheduleFeedRecovery(name);
    });
    socket.addEventListener('error', (event) => {
      if (!current()) return;
      onError?.(event, name);
      // A WebSocket error is normally followed by close. Force recovery if not.
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    });
  };

  const scheduleFeedRecovery = (name) => {
    const feed = feeds[name];
    if (disposed || feed.timer !== null) return;
    report(name, 'RECONNECTING');
    const delay = reconnectDelay(feed.attempt++);
    feed.timer = setTimeoutFn(() => {
      feed.timer = null;
      openFeed(name);
    }, delay);
  };

  openFeed('market');
  openFeed('book');

  return {
    get readyState() {
      if (feeds.market.open) return WebSocket.OPEN;
      if (feeds.market.socket?.readyState === WebSocket.CONNECTING || feeds.market.timer !== null) return WebSocket.CONNECTING;
      return WebSocket.CLOSED;
    },
    reconnectFeed(name) {
      if (disposed || !Object.hasOwn(feeds, name)) return false;
      const feed = feeds[name];
      if (feed.timer !== null) return false;
      ++feed.generation;
      feed.open = false;
      const currentSocket = feed.socket;
      feed.socket = null;
      if (currentSocket && (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)) currentSocket.close();
      scheduleFeedRecovery(name);
      return true;
    },
    close(reason = 'Client cleanup') {
      if (disposed) return;
      disposed = true;
      for (const feed of Object.values(feeds)) {
        ++feed.generation;
        if (feed.timer !== null) clearTimeoutFn(feed.timer);
        feed.timer = null;
        feed.open = false;
        const socket = feed.socket;
        feed.socket = null;
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
          socket.close(1000, reason.slice(0, 120));
        }
      }
    }
  };
}
