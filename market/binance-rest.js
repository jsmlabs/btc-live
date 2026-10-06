import { normalizeRestBookTicker, normalizeRestTicker } from './validators.js';

export const FUTURES_REST_BASE_URL = 'https://fapi.binance.com';
const TICKER_URL = 'https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT';
const BOOK_TICKER_URL = 'https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=BTCUSDT';
const DEFAULT_TIMEOUT_MS = 5000;

async function fetchJson(url, signal, label) {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    signal,
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    const error = new Error(`Binance Futures ${label} request failed with HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function fetchBtcSnapshot({ timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason ?? new DOMException('Request aborted', 'AbortError'));
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });

  const timeoutId = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    timeoutMs
  );

  try {
    const [tickerPayload, bookPayload] = await Promise.all([
      fetchJson(TICKER_URL, controller.signal, '24h ticker'),
      fetchJson(BOOK_TICKER_URL, controller.signal, 'book ticker')
    ]);
    const receivedAt = Date.now();
    const ticker = normalizeRestTicker(tickerPayload, receivedAt);
    const book = normalizeRestBookTicker(bookPayload, receivedAt);
    if (!ticker || !book) throw new Error('Binance Futures REST response failed validation');

    return {
      ...ticker,
      ...book,
      source: 'REST',
      tickerSource: 'REST',
      bookSource: 'REST',
      lastValidUpdateAt: receivedAt
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
