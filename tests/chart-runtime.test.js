import assert from 'node:assert/strict';
import test from 'node:test';
import { CHART_STATUS, createBtcChartRuntime } from '../app/chart-runtime.js';

const NOW = 1_800_000_000_000;
const BASE = [
  { openTime: NOW - 600_000, open: 100_000, high: 100_100, low: 99_900, close: 100_050, volume: 10, closeTime: NOW - 300_001 },
  { openTime: NOW - 300_000, open: 100_050, high: 100_200, low: 100_000, close: 100_100, volume: 12, closeTime: NOW - 1 }
];

test('chart runtime loads candles and advances the active candle from live market state', async () => {
  const renders = [];
  let refreshCallback;
  const runtime = createBtcChartRuntime({
    onChange: (snapshot) => renders.push(snapshot),
    fetchKlines: async () => BASE,
    loadPreferences: async () => ({ interval: '5m', mode: 'candles', showVolume: true }),
    persistPreferences: async (value) => value,
    setIntervalFn(callback) { refreshCallback = callback; return 1; },
    clearIntervalFn() {},
    now: () => NOW
  });

  await runtime.start();
  assert.equal(runtime.snapshot().status, CHART_STATUS.READY);
  assert.equal(runtime.snapshot().candles.length, 2);
  assert.equal(typeof refreshCallback, 'function');

  runtime.ingestMarketState({
    currentPrice: 100_250,
    lastPriceEventAt: NOW + 1,
    lastPriceTradeId: 42,
    priceSource: 'TRADE'
  });
  const after = runtime.snapshot();
  assert.equal(after.candles.length, 3);
  assert.equal(after.candles.at(-1).open, 100_250);
  assert.equal(after.candles.at(-1).close, 100_250);

  runtime.ingestMarketState({
    currentPrice: 100_300,
    lastPriceEventAt: NOW + 2,
    lastPriceTradeId: 43,
    priceSource: 'TRADE'
  });
  assert.equal(runtime.snapshot().candles.at(-1).high, 100_300);
  assert.equal(runtime.snapshot().candles.at(-1).close, 100_300);
  assert.ok(renders.length >= 4);
  runtime.dispose();
});

test('chart runtime reloads only when the interval changes', async () => {
  const intervals = [];
  const runtime = createBtcChartRuntime({
    fetchKlines: async ({ interval }) => { intervals.push(interval); return BASE; },
    loadPreferences: async () => ({ interval: '5m', mode: 'candles', showVolume: true }),
    persistPreferences: async (value) => value,
    setIntervalFn: () => 1,
    clearIntervalFn() {},
    now: () => NOW
  });
  await runtime.start();
  await runtime.updatePreferences({ mode: 'line' });
  await runtime.updatePreferences({ showVolume: false });
  await runtime.updatePreferences({ interval: '15m' });
  assert.deepEqual(intervals, ['5m', '15m']);
  assert.deepEqual(runtime.snapshot().preferences, { interval: '15m', mode: 'line', showVolume: false });
  runtime.dispose();
});

test('chart runtime keeps existing candles visible on background refresh failure', async () => {
  let calls = 0;
  const runtime = createBtcChartRuntime({
    fetchKlines: async () => {
      calls += 1;
      if (calls === 1) return BASE;
      throw new Error('temporary');
    },
    loadPreferences: async () => ({ interval: '5m', mode: 'candles', showVolume: true }),
    persistPreferences: async (value) => value,
    setIntervalFn: () => 1,
    clearIntervalFn() {},
    now: () => NOW
  });
  await runtime.start();
  await runtime.reload({ background: true });
  assert.equal(runtime.snapshot().status, CHART_STATUS.READY);
  assert.equal(runtime.snapshot().candles.length, 2);
  assert.equal(runtime.snapshot().errorMessage, 'Chart refresh delayed.');
  runtime.dispose();
});


test('chart runtime rejects unsafe timing and limit configuration', () => {
  assert.throws(() => createBtcChartRuntime({ limit: 10 }), /between 30 and 500/);
  assert.throws(() => createBtcChartRuntime({ refreshMs: 1000 }), /at least 5000ms/);
  assert.throws(() => createBtcChartRuntime({ fetchKlines: null }), /data adapters must be functions/);
});
