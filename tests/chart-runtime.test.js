import assert from 'node:assert/strict';
import test from 'node:test';
import { CHART_STATUS, createBtcChartRuntime } from '../app/chart-runtime.js';

const NOW = 1_800_000_000_000;
const BASE = [
  { openTime: NOW - 600_000, open: 100_000, high: 100_100, low: 99_900, close: 100_050, volume: 10, closeTime: NOW - 300_001 },
  { openTime: NOW - 300_000, open: 100_050, high: 100_200, low: 100_000, close: 100_100, volume: 12, closeTime: NOW - 1 }
];
function harness(overrides = {}) {
  const sockets = [];
  const intervals = [];
  const runtime = createBtcChartRuntime({
    fetchKlines: async () => BASE,
    loadPreferences: async () => ({ interval: '5m', mode: 'candles', showVolume: true }),
    persistPreferences: async value => value,
    createSocket(url) {
      const socket = { url, close() { this.closed = true; } };
      sockets.push(socket);
      return socket;
    },
    setIntervalFn(callback) { intervals.push(callback); return intervals.length; },
    clearIntervalFn() {},
    setTimeoutFn() { return 100; },
    clearTimeoutFn() {},
    now: () => NOW,
    ...overrides
  });
  return { runtime, sockets, intervals };
}

test('REST snapshots remain syncing until a valid exchange WebSocket kline arrives', async () => {
  const { runtime, sockets } = harness();
  try {
    await runtime.start();
    assert.equal(runtime.snapshot().status, CHART_STATUS.SYNCING);
    assert.equal(runtime.snapshot().candles.length, 2);
    assert.equal(sockets.length, 1);
    assert.match(sockets[0].url, /btcusdt@kline_5m$/);
    runtime.ingestMarketState({ currentPrice: 100_300, lastPriceEventAt: NOW + 1, priceSource: 'TRADE' });
    assert.equal(runtime.snapshot().candles.length, 2, 'ticker trade must not synthesize OHLCV');
    assert.equal(runtime.snapshot().status, CHART_STATUS.SYNCING);
  } finally { runtime.dispose(); }
});

test('chart runtime reloads only on interval changes and keeps normalized preferences', async () => {
  const selected = [];
  const { runtime } = harness({ fetchKlines: async ({ interval }) => { selected.push(interval); return BASE; } });
  try {
    await runtime.start();
    await runtime.updatePreferences({ mode: 'line' });
    await runtime.updatePreferences({ showVolume: false });
    await runtime.updatePreferences({ interval: '15m' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(selected, ['5m', '15m']);
    assert.equal(runtime.snapshot().preferences.interval, '15m');
    assert.equal(runtime.snapshot().preferences.mode, 'line');
    assert.equal(runtime.snapshot().preferences.showVolume, false);
  } finally { runtime.dispose(); }
});

test('failed background refresh preserves candles and marks the snapshot stale', async () => {
  let calls = 0;
  const { runtime } = harness({ fetchKlines: async () => {
    calls++;
    if (calls === 1) return BASE;
    throw new Error('temporary');
  } });
  try {
    await runtime.start();
    await runtime.reload({ background: true });
    assert.equal(runtime.snapshot().status, CHART_STATUS.STALE);
    assert.equal(runtime.snapshot().candles.length, 2);
    assert.equal(runtime.snapshot().errorMessage, 'Snapshot refresh delayed.');
  } finally { runtime.dispose(); }
});

test('chart runtime rejects unsafe timing, adapters and limit configuration', () => {
  assert.throws(() => createBtcChartRuntime({ limit: 10 }), /between 30 and 500/);
  assert.throws(() => createBtcChartRuntime({ refreshMs: 1000 }), /at least 5000ms/);
  assert.throws(() => createBtcChartRuntime({ fetchKlines: null }), /data and timing adapters must be functions/);
});
