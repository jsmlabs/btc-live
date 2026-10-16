import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartModel, subscribeChartRedraw, notifyChartRedraw } from '../ui/chart.js';

const candles = [
  { openTime: 1, open: 100, high: 110, low: 95, close: 105, volume: 10, closeTime: 2 },
  { openTime: 3, open: 105, high: 108, low: 98, close: 100, volume: 20, closeTime: 4 },
  { openTime: 5, open: 100, high: 112, low: 99, close: 111, volume: 15, closeTime: 6 }
];

test('chart model creates candle geometry, axes and reference levels deterministically', () => {
  const model = buildChartModel(candles, {
    showVolume: true,
    currentPrice: 111,
    open24h: 100,
    high24h: 120,
    low24h: 90
  });
  assert.equal(model.candles.length, 3);
  assert.equal(model.candles[0].direction, 'up');
  assert.equal(model.candles[1].direction, 'down');
  assert.equal(model.priceTicks.length, 5);
  assert.equal(model.timeTicks.length, 3);
  assert.equal(model.showVolume, true);
  assert.ok(model.linePoints.includes(','));
  assert.equal(model.referenceLevels.find((level) => level.key === 'current').inRange, true);
  assert.equal(model.referenceLevels.find((level) => level.key === 'high24h').inRange, false);
});

test('chart model expands price area when volume is hidden', () => {
  const withVolume = buildChartModel(candles, { showVolume: true });
  const withoutVolume = buildChartModel(candles, { showVolume: false });
  assert.ok(withoutVolume.priceBottom > withVolume.priceBottom);
  assert.equal(withoutVolume.showVolume, false);
});

test('invalid nonpositive market references are omitted rather than charted', () => {
  const baseline = buildChartModel(candles);
  const model = buildChartModel(candles, {
    currentPrice: 0,
    open24h: -1,
    high24h: 0,
    low24h: Number.POSITIVE_INFINITY
  });
  assert.deepEqual(model.referenceLevels, []);
  assert.equal(model.minPrice, baseline.minPrice);
  assert.equal(model.maxPrice, baseline.maxPrice);
  const valid = buildChartModel(candles, {currentPrice: 150, high24h: 125});
  assert.equal(valid.referenceLevels.length, 2);
  assert.ok(valid.maxPrice > baseline.maxPrice);
});

test('chart model handles empty data explicitly', () => {
  assert.equal(buildChartModel([]), null);
  assert.equal(buildChartModel(null), null);
});

test('chart redraw subscriptions are independent and dispose exactly once', () => {
  const svg = {};
  const calls = [];
  const unsubscribeA = subscribeChartRedraw(svg, model => calls.push(['a',model]));
  const unsubscribeB = subscribeChartRedraw(svg, model => calls.push(['b',model]));
  notifyChartRedraw(svg, 1);
  assert.deepEqual(calls,[['a',1],['b',1]]);
  unsubscribeA();
  unsubscribeA();
  notifyChartRedraw(svg, 2);
  assert.deepEqual(calls,[['a',1],['b',1],['b',2]]);
  unsubscribeB();
  notifyChartRedraw(svg, 3);
  assert.equal(calls.length,3);
});

test('chart redraw notification tolerates observer disposal during iteration', () => {
  const svg = {};
  const seen = [];
  let unsubscribeB;
  const unsubscribeA = subscribeChartRedraw(svg, () => { seen.push('a'); unsubscribeB(); });
  unsubscribeB = subscribeChartRedraw(svg, () => seen.push('b'));
  notifyChartRedraw(svg, null);
  assert.deepEqual(seen,['a','b']);
  notifyChartRedraw(svg, null);
  assert.deepEqual(seen,['a','b','a']);
  unsubscribeA();
});
