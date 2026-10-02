import { normalizeRestTicker } from './validators.js';

const REST_URL = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';
const DEFAULT_TIMEOUT_MS = 5000;

export async function fetchBtcSnapshot({ timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason ?? new DOMException('Request aborted', 'AbortError'));
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });

  const timeoutId = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    timeoutMs
  );

  try {
    const response = await fetch(REST_URL, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      const error = new Error(`Binance REST request failed with HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    const normalized = normalizeRestTicker(payload);
    if (!normalized) throw new Error('Binance REST response failed validation');
    return normalized;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
