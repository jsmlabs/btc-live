import { normalizeTickerEvent, normalizeTradeEvent } from './validators.js';

export const STREAM_URL = 'wss://stream.binance.com:443/stream?streams=btcusdt@trade/btcusdt@ticker';

export function createBinanceSocket({ onTrade, onTicker, onOpen, onClose, onError }) {
  const socket = new WebSocket(STREAM_URL);

  socket.addEventListener('open', () => onOpen?.());
  socket.addEventListener('message', (event) => {
    let envelope;
    try {
      envelope = JSON.parse(event.data);
    } catch {
      return;
    }

    const payload = envelope?.data;
    if (!payload) return;

    if (payload.e === 'trade') {
      const trade = normalizeTradeEvent(payload);
      if (trade) onTrade?.(trade);
      return;
    }

    if (payload.e === '24hrTicker') {
      const ticker = normalizeTickerEvent(payload);
      if (ticker) onTicker?.(ticker);
    }
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
