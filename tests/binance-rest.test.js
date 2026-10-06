import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBtcSnapshot } from '../market/binance-rest.js';

function payload() {
  const now = Date.now();
  return {
    symbol: 'BTCUSDT',
    lastPrice: '100000',
    priceChange: '1200',
    priceChangePercent: '1.215',
    openPrice: '98800',
    highPrice: '101000',
    lowPrice: '98000',
    volume: '1000',
    quoteVolume: '100000000',
    bidPrice: '99999.9',
    askPrice: '100000.1',
    closeTime: now,
    lastId: 123456
  };
}

test('fetchBtcSnapshot validates a successful HTTP response', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    return { ok: true, json: async () => payload() };
  };

  const snapshot = await fetchBtcSnapshot({ timeoutMs: 1000 });
  assert.equal(snapshot.currentPrice, 100000);
  assert.equal(snapshot.source, 'REST');
});

test('fetchBtcSnapshot exposes HTTP status on failures', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({ ok: false, status: 429 });

  await assert.rejects(
    fetchBtcSnapshot({ timeoutMs: 1000 }),
    (error) => error.status === 429 && /HTTP 429/.test(error.message)
  );
});

test('fetchBtcSnapshot aborts requests that exceed timeout', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });

  await assert.rejects(fetchBtcSnapshot({ timeoutMs: 5 }), (error) => error?.name === 'TimeoutError');
});

test('fetchBtcSnapshot rejects invalid timeout configuration before calling fetch', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return { ok: true, json: async () => payload() };
  };

  await assert.rejects(fetchBtcSnapshot({ timeoutMs: 0 }), TypeError);
  await assert.rejects(fetchBtcSnapshot({ timeoutMs: Number.POSITIVE_INFINITY }), TypeError);
  assert.equal(called, false);
});
