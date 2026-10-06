import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBtcKlines, intervalMs, normalizeKlineRow, normalizeKlines } from '../market/binance-klines.js';

const ROWS = [
  [1_800_000_000_000, '100000', '100100', '99900', '100050', '12.5', 1_800_000_059_999],
  [1_800_000_060_000, '100050', '100250', '100000', '100200', '8.25', 1_800_000_119_999]
];

const ROWS_15M = [
  [1_800_000_000_000, '100000', '100100', '99900', '100050', '12.5', 1_800_000_899_999],
  [1_800_000_900_000, '100050', '100250', '100000', '100200', '8.25', 1_800_001_799_999]
];

test('kline intervals expose deterministic millisecond durations', () => {
  assert.equal(intervalMs('1m'), 60_000);
  assert.equal(intervalMs('5m'), 300_000);
  assert.equal(intervalMs('15m'), 900_000);
  assert.throws(() => intervalMs('1h'), /Unsupported/);
});

test('normalizeKlineRow validates OHLCV invariants', () => {
  assert.deepEqual(normalizeKlineRow(ROWS[0]), {
    openTime: 1_800_000_000_000,
    open: 100_000,
    high: 100_100,
    low: 99_900,
    close: 100_050,
    volume: 12.5,
    closeTime: 1_800_000_059_999
  });
  assert.equal(normalizeKlineRow([1, '100', '99', '98', '100', '1', 2]), null);
  assert.equal(normalizeKlineRow([1, '100', '101', '99', '100', '-1', 2]), null);
});

test('normalizeKlines rejects duplicate or out-of-order candles', () => {
  assert.equal(normalizeKlines([ROWS[0], ROWS[0]]), null);
  assert.equal(normalizeKlines([ROWS[1], ROWS[0]]), null);
  assert.equal(normalizeKlines([]), null);
  assert.equal(normalizeKlines(ROWS)?.length, 2);
});

test('fetchBtcKlines requests the selected BTCUSDT interval and validates response', async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = new URL(url);
    return { ok: true, json: async () => ROWS_15M };
  };

  const candles = await fetchBtcKlines({ interval: '15m', limit: 60 });
  assert.equal(requestedUrl.hostname, 'fapi.binance.com');
  assert.equal(requestedUrl.pathname, '/fapi/v1/klines');
  assert.equal(requestedUrl.searchParams.get('symbol'), 'BTCUSDT');
  assert.equal(requestedUrl.searchParams.get('interval'), '15m');
  assert.equal(requestedUrl.searchParams.get('limit'), '60');
  assert.equal(candles.length, 2);
});


test('fetchBtcKlines rejects candles with invalid interval boundaries', async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ROWS });
  await assert.rejects(
    fetchBtcKlines({ interval: '15m', limit: 60 }),
    /invalid interval boundaries/
  );
});

test('fetchBtcKlines rejects invalid interval and limit before fetch', async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: true, json: async () => ROWS }; };

  await assert.rejects(fetchBtcKlines({ interval: '1h' }), /Unsupported/);
  await assert.rejects(fetchBtcKlines({ limit: 10 }), /between 30 and 500/);
  assert.equal(calls, 0);
});
