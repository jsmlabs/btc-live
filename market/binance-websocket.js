import { normalizeTickerEvent, normalizeTradeEvent } from './validators.js';

export const STREAM_URL = 'wss://stream.binance.com:443/stream?streams=btcusdt@trade/btcusdt@ticker';

export function parseCombinedMessage(rawMessage, now = Date.now()) {
  let envelope;
  try {
    envelope = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
  } catch {
    return null;
  }

  const payload = envelope?.data;
  if (!payload) return null;

  if (payload.e === 'trade') {
    const value = normalizeTradeEvent(payload, now);
    return value ? { type: 'trade', value } : null;
  }

  if (payload.e === '24hrTicker') {
    const value = normalizeTickerEvent(payload, now);
    return value ? { type: 'ticker', value } : null;
  }

  return null;
}

export function createBinanceSocket({ onTrade, onTicker, onOpen, onClose, onError }) {
  const socket = new WebSocket(STREAM_URL);

  socket.addEventListener('open', () => onOpen?.());
  socket.addEventListener('message', (event) => {
    const parsed = parseCombinedMessage(event.data);
    if (!parsed) return;
    if (parsed.type === 'trade') onTrade?.(parsed.value);
    else onTicker?.(parsed.value);
  });
  socket.addEventListener('close', (event) => onClose?.(event));
  socket.addEventListener('error', (event) => onError?.(event));

  return {
    get readyState() {
      return socket.readyState;
    },
    close(reason = 'Client cleanup') {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, reason.slice(0, 120));
      }
    }
  };
}
