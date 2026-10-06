import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartModel } from '../ui/chart.js';

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

test('chart model handles empty data explicitly', () => {
  assert.equal(buildChartModel([]), null);
  assert.equal(buildChartModel(null), null);
});
