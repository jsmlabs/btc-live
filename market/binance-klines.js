export const KLINE_INTERVALS = Object.freeze(['1m', '5m', '15m']);
export const DEFAULT_KLINE_INTERVAL = '5m';
export const DEFAULT_KLINE_LIMIT = 120;
export const KLINE_REFRESH_MS = 30_000;

const REST_URL = 'https://api.binance.com/api/v3/klines';
const DEFAULT_TIMEOUT_MS = 5000;

const INTERVAL_MS = Object.freeze({
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000
});

export function intervalMs(interval) {
  const value = INTERVAL_MS[interval];
  if (!value) throw new RangeError(`Unsupported kline interval: ${interval}`);
  return value;
}

export function normalizeKlineRow(row) {
  if (!Array.isArray(row) || row.length < 7) return null;
  const openTime = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  const volume = Number(row[5]);
  const closeTime = Number(row[6]);

  if (!Number.isSafeInteger(openTime) || !Number.isSafeInteger(closeTime) || closeTime < openTime) return null;
  if (![open, high, low, close].every((value) => Number.isFinite(value) && value > 0)) return null;
  if (!Number.isFinite(volume) || volume < 0) return null;
  if (high < Math.max(open, close) || low > Math.min(open, close) || low > high) return null;

  return { openTime, open, high, low, close, volume, closeTime };
}

export function normalizeKlines(payload) {
  if (!Array.isArray(payload)) return null;
  const output = [];
  let previousOpen = -1;

  for (const row of payload) {
    const candle = normalizeKlineRow(row);
    if (!candle || candle.openTime <= previousOpen) return null;
    previousOpen = candle.openTime;
    output.push(candle);
  }

  return output.length ? output : null;
}

export async function fetchBtcKlines({
  interval = DEFAULT_KLINE_INTERVAL,
  limit = DEFAULT_KLINE_LIMIT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal
} = {}) {
  intervalMs(interval);
  if (!Number.isSafeInteger(limit) || limit < 30 || limit > 500) {
    throw new RangeError('limit must be an integer between 30 and 500');
  }
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

  const url = new URL(REST_URL);
  url.searchParams.set('symbol', 'BTCUSDT');
  url.searchParams.set('interval', interval);
  url.searchParams.set('limit', String(limit));

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      const error = new Error(`Binance kline request failed with HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    const normalized = normalizeKlines(payload);
    if (!normalized) throw new Error('Binance kline response failed validation');

    const duration = intervalMs(interval);
    const structurallyValid = normalized.every((candle) =>
      candle.openTime % duration === 0 && candle.closeTime === candle.openTime + duration - 1
    );
    if (!structurallyValid) throw new Error('Binance kline response has invalid interval boundaries');
    return normalized;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
