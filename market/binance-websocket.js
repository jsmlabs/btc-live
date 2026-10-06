import { normalizeBookTickerEvent, normalizeTickerEvent, normalizeTradeEvent } from './validators.js';

export const MARKET_STREAM_URL = 'wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade/btcusdt@ticker';
export const PUBLIC_STREAM_URL = 'wss://fstream.binance.com/public/stream?streams=btcusdt@bookTicker';

export function parseCombinedMessage(rawMessage, now = Date.now()) {
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

export function createBinanceSocket({ onTrade, onTicker, onBookTicker, onOpen, onClose, onError }) {
  const marketSocket = new WebSocket(MARKET_STREAM_URL);
  const publicSocket = new WebSocket(PUBLIC_STREAM_URL);
  let marketOpen = false;
  let publicOpen = false;
  let openNotified = false;
  let closeNotified = false;

  const maybeNotifyOpen = () => {
    if (!openNotified && marketOpen && publicOpen) {
      openNotified = true;
      onOpen?.();
    }
  };

  const closeSocket = (socket, reason) => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, reason.slice(0, 120));
    }
  };

  const handleClose = (closedSocket, otherSocket, event) => {
    if (closedSocket === marketSocket) marketOpen = false;
    else publicOpen = false;
    closeSocket(otherSocket, 'Paired stream closed');
    if (!closeNotified) {
      closeNotified = true;
      onClose?.(event);
    }
  };

  const handleMessage = (event) => {
    const parsed = parseCombinedMessage(event.data);
    if (!parsed) return;
    if (parsed.type === 'trade') onTrade?.(parsed.value);
    else if (parsed.type === 'ticker') onTicker?.(parsed.value);
    else onBookTicker?.(parsed.value);
  };

  marketSocket.addEventListener('open', () => {
    marketOpen = true;
    maybeNotifyOpen();
  });
  publicSocket.addEventListener('open', () => {
    publicOpen = true;
    maybeNotifyOpen();
  });
  marketSocket.addEventListener('message', handleMessage);
  publicSocket.addEventListener('message', handleMessage);
  marketSocket.addEventListener('close', (event) => handleClose(marketSocket, publicSocket, event));
  publicSocket.addEventListener('close', (event) => handleClose(publicSocket, marketSocket, event));
  marketSocket.addEventListener('error', (event) => onError?.(event));
  publicSocket.addEventListener('error', (event) => onError?.(event));

  return {
    get readyState() {
      if (marketOpen && publicOpen) return WebSocket.OPEN;
      if ([marketSocket.readyState, publicSocket.readyState].includes(WebSocket.CONNECTING)) return WebSocket.CONNECTING;
      return WebSocket.CLOSED;
    },
    close(reason = 'Client cleanup') {
      closeSocket(marketSocket, reason);
      closeSocket(publicSocket, reason);
    }
  };
}
