import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderFlowAccumulator } from '../ui/order-flow.js';
import { createBtcChartRuntime } from '../app/chart-runtime.js';
import { intervalMs, normalizeKlineRow } from '../market/binance-klines.js';
import { createEventRecorder, parseEventRecording } from '../ui/event-recorder.js';
import { replayEventRecording, evaluateEventConfluence } from '../ui/event-replay.js';

test('AUD-01: multiwindow and legacy totals use the same bucket boundaries', () => {
  const flow = createOrderFlowAccumulator();
  for (let i = 0; i <= 310; i++) {
    flow.ingest({ id: i, side: i % 2 ? 'sell' : 'buy', quantity: 1, notional: 100, tradeAt: i * 1000 }, i * 1000, 1);
  }
  for (const at of [310000, 310001, 310500, 310999]) {
    const s = flow.snapshot(at, 'LIVE');
    assert.equal(s.windows['10000'].count, 10);
    assert.equal(s.windows['30000'].count, 30);
    assert.equal(s.windows['60000'].count, s.count);
    assert.equal(s.windows['60000'].deltaBtc, s.deltaBtc);
    assert.equal(s.windows['300000'].count, 300);
    assert.equal(s.windows['300000'].deltaBtc, 0);
  }
});

test('AUD-02: interval changes never emit new timeframe with previous OHLCV', async () => {
  const now = 1800000000000;
  const snapshots = [];
  const durations = { '5m': 300000, '15m': 900000, '1h': 3600000 };
  const chart = createBtcChartRuntime({
    now: () => now,
    loadPreferences: async () => ({ interval: '5m' }),
    persistPreferences: async () => {},
    fetchKlines: async ({interval}) => [{ openTime: now, closeTime: now + durations[interval] - 1, open: 100, high: 101, low: 99, close: 100, volume: 1 }],
    createSocket: () => ({ close() {} }),
    setIntervalFn: () => 1, clearIntervalFn: () => {},
    setTimeoutFn: () => 1, clearTimeoutFn: () => {},
    onChange: (snapshot) => snapshots.push(snapshot)
  });
  try {
    await chart.start();
    await chart.updatePreferences({ interval: '15m' });
    chart.syncPreferences({ interval: '1h' });
    await Promise.resolve();
    assert.ok(snapshots.some(s => s.preferences.interval === '5m' && s.candles.length));
    assert.ok(snapshots.some(s => s.preferences.interval === '15m'));
    assert.ok(snapshots.some(s => s.preferences.interval === '1h'));
    for (const s of snapshots) for (const candle of s.candles) {
      assert.equal(candle.closeTime - candle.openTime + 1, durations[s.preferences.interval]);
    }
  } finally { chart.dispose(); }
});

test('AUD-03: kline parser rejects coercion and inherited interval keys', () => {
  for (const invalid of ['constructor', 'toString', '__proto__', ['5m']]) {
    assert.throws(() => intervalMs(invalid), /Unsupported/);
  }
  const valid = [1800000000000, '100', '101', '99', '100', '0', 1800000059999];
  assert.equal(normalizeKlineRow(valid).volume, 0);
  for (const value of [null, false, true, '', ' ', [], {}]) {
    for (const index of [0, 1, 5, 6]) {
      const row = [...valid]; row[index] = value;
      assert.equal(normalizeKlineRow(row), null);
    }
  }
  assert.equal(normalizeKlineRow([-1, '100', '101', '99', '100', '0', 10]), null);
});

test('AUD-04: recorder accepts ordered repeated depth diffs but rejects duplicate snapshot prices', () => {
  const recorder = createEventRecorder();
  recorder.start();
  const at = 1800000000000;
  const snapshot = { updateId: 100, bids: [[99, 2]], asks: [[101, 1]] };
  assert.equal(recorder.append('depth.snapshot', snapshot, at), true);
  assert.equal(recorder.append('depth.diff', { firstId: 101, finalId: 101, prevId: 100, eventAt: at + 1, bids: [[99, 0], [99, 5]], asks: [] }, at + 1), true);
  const json = recorder.exportJson();
  assert.deepEqual(parseEventRecording(json).events[1].bids, [[99, 0], [99, 5]]);
  const frames = replayEventRecording(json, 25);
  assert.equal(frames[1].depthReady, true);
  assert.equal(frames[1].bidNotional, 495);
  recorder.start();
  assert.equal(recorder.append('depth.snapshot', {...snapshot, bids: [[99, 2], [99, 3]]}, at), false);
});

test('AUD-05: confluence never bridges different depth anchors', () => {
  const frame = (at, depthFrom, kind, tradeSide, tradeQuantity, tradePrice) => ({
    at, depthFrom, kind, tradeSide, tradeQuantity, tradePrice,
    depthReady: true, flowSegment: 1, bidNotional: 100, askNotional: 100
  });
  const frames = [frame(1000, 1, 'trade', 'buy', 1, 100), frame(2000, 2, 'depth.diff', null, null, null), frame(3000, 1, 'trade', 'buy', 1, 101)];
  assert.equal(evaluateEventConfluence(frames, 2).status, 'UNAVAILABLE');
  frames[1].depthFrom = 1;
  assert.equal(evaluateEventConfluence(frames, 2).status, 'OBSERVED');
});
