import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBtcSnapshot } from '../market/binance-rest.js';

function tickerPayload(now = Date.now()) {
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
    closeTime: now,
    lastId: 123456
  };
}

function bookPayload(now = Date.now()) {
  return {
    symbol: 'BTCUSDT',
    bidPrice: '99999.9',
    bidQty: '1.5',
    askPrice: '100000.1',
    askQty: '1.2',
    time: now
  };
}

test('fetchBtcSnapshot combines Binance Futures ticker and top-of-book responses', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const requested = [];
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    requested.push(parsed);
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    const body = parsed.pathname.endsWith('/bookTicker') ? bookPayload() : tickerPayload();
    return { ok: true, json: async () => body };
  };

  const snapshot = await fetchBtcSnapshot({ timeoutMs: 1000 });
  assert.equal(snapshot.currentPrice, 100000);
  assert.equal(snapshot.bidPrice, 99999.9);
  assert.equal(snapshot.askPrice, 100000.1);
  assert.equal(snapshot.source, 'REST');
  assert.equal(snapshot.tickerSource, 'REST');
  assert.equal(snapshot.bookSource, 'REST');
  assert.deepEqual(requested.map((url) => url.hostname), ['fapi.binance.com', 'fapi.binance.com']);
  assert.deepEqual(requested.map((url) => url.pathname).sort(), ['/fapi/v1/ticker/24hr', '/fapi/v1/ticker/bookTicker']);
  assert.equal(requested.every((url) => url.searchParams.get('symbol') === 'BTCUSDT'), true);
});

test('fetchBtcSnapshot exposes HTTP status on Futures request failures', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({ ok: false, status: 429 });

  await assert.rejects(
    fetchBtcSnapshot({ timeoutMs: 1000 }),
    (error) => error.status === 429 && /HTTP 429/.test(error.message)
  );
});

test('fetchBtcSnapshot aborts Futures requests that exceed timeout', async (t) => {
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
    return { ok: true, json: async () => tickerPayload() };
  };

  await assert.rejects(fetchBtcSnapshot({ timeoutMs: 0 }), TypeError);
  await assert.rejects(fetchBtcSnapshot({ timeoutMs: Number.POSITIVE_INFINITY }), TypeError);
  assert.equal(called, false);
});
