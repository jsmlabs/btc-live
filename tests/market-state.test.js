import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONNECTION_STATUS,
  STALE_AFTER_MS,
  applySnapshot,
  applyTicker,
  applyTrade,
  createInitialMarketState,
  deriveFreshnessStatus,
  withStatus
} from '../market/market-state.js';

test('snapshot derives spread and range position', () => {
  const state = applySnapshot(createInitialMarketState(), {
    currentPrice: 100, open24h: 95, low24h: 80, high24h: 120,
    bidPrice: 99.5, askPrice: 100.5, lastTickerAt: 1000, lastValidUpdateAt: 1000, source: 'REST'
  });
  assert.equal(state.open24h, 95);
  assert.equal(state.spreadAbsolute, 1);
  assert.equal(state.spreadPercent, 1);
  assert.equal(state.rangePositionPercent, 50);
  assert.equal(state.lastPriceEventAt, 1000);
});

test('snapshot can preserve a fresher websocket price', () => {
  const initial = { ...createInitialMarketState(), currentPrice: 105, source: 'WEBSOCKET', lastPriceEventAt: 2000 };
  const state = applySnapshot(initial, {
    currentPrice: 100, open24h: 90, low24h: 80, high24h: 120,
    bidPrice: 99, askPrice: 101, lastTickerAt: 1500, lastValidUpdateAt: 2500, source: 'REST'
  }, { preservePrice: true });
  assert.equal(state.currentPrice, 105);
  assert.equal(state.source, 'WEBSOCKET');
});

test('older REST snapshots do not overwrite newer live ticker fields', () => {
  const live = applyTicker(createInitialMarketState(), {
    currentPrice: 105, priceChange24h: 5, priceChangePercent24h: 5,
    open24h: 100, low24h: 90, high24h: 110, baseVolume24h: 10, quoteVolume24h: 1000,
    bidPrice: 104.9, askPrice: 105.1, lastTickerAt: 2000, lastValidUpdateAt: 2100, source: 'WEBSOCKET'
  });
  const merged = applySnapshot(live, {
    currentPrice: 99, priceChange24h: 1, priceChangePercent24h: 1,
    open24h: 98, low24h: 80, high24h: 101, baseVolume24h: 5, quoteVolume24h: 500,
    bidPrice: 98.9, askPrice: 99.1, lastTickerAt: 1900, lastValidUpdateAt: 2200, source: 'REST'
  });
  assert.equal(merged.currentPrice, 105);
  assert.equal(merged.high24h, 110);
  assert.equal(merged.bidPrice, 104.9);
  assert.equal(merged.source, 'WEBSOCKET');
});

test('trade updates direction deterministically', () => {
  const initial = { ...createInitialMarketState(), currentPrice: 100 };
  const up = applyTrade(initial, { currentPrice: 101, lastTradeAt: 1000, lastValidUpdateAt: 1000, source: 'WEBSOCKET' });
  assert.equal(up.previousPrice, 100);
  assert.equal(up.priceDirection, 'UP');
  assert.equal(up.lastPriceEventAt, 1000);
});

test('ticker can update current price when it is the newest price event', () => {
  const initial = { ...createInitialMarketState(), currentPrice: 100, lastPriceEventAt: 900 };
  const next = applyTicker(initial, { currentPrice: 99, lastTickerAt: 1000, lastValidUpdateAt: 1000, source: 'WEBSOCKET' });
  assert.equal(next.currentPrice, 99);
  assert.equal(next.priceDirection, 'DOWN');
});

test('older ticker cannot overwrite a newer trade price', () => {
  const traded = applyTrade({ ...createInitialMarketState(), currentPrice: 100 }, {
    currentPrice: 102, lastTradeAt: 2000, lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const next = applyTicker(traded, {
    currentPrice: 101, high24h: 110, low24h: 90, bidPrice: 100.9, askPrice: 101.1,
    lastTickerAt: 1900, lastValidUpdateAt: 2002, source: 'WEBSOCKET'
  });
  assert.equal(next.currentPrice, 102);
  assert.equal(next.lastPriceEventAt, 2000);
  assert.equal(next.high24h, 110);
});

test('out-of-order ticker snapshots are ignored', () => {
  const current = applyTicker(createInitialMarketState(), {
    currentPrice: 100, high24h: 110, low24h: 90, bidPrice: 99, askPrice: 101,
    lastTickerAt: 2000, lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const stale = applyTicker(current, {
    currentPrice: 80, high24h: 90, low24h: 70, bidPrice: 79, askPrice: 81,
    lastTickerAt: 1999, lastValidUpdateAt: 3000, source: 'WEBSOCKET'
  });
  assert.strictEqual(stale, current);
});

test('freshness marks live data stale after threshold', () => {
  const state = withStatus({ ...createInitialMarketState(), lastPriceEventAt: 1000, lastValidUpdateAt: 1000 }, CONNECTION_STATUS.LIVE);
  assert.equal(deriveFreshnessStatus(state, 1000 + STALE_AFTER_MS), CONNECTION_STATUS.LIVE);
  assert.equal(deriveFreshnessStatus(state, 1001 + STALE_AFTER_MS), CONNECTION_STATUS.STALE);
});

test('range position is clamped for temporarily inconsistent market snapshots', () => {
  const high = applySnapshot(createInitialMarketState(), {
    currentPrice: 125, open24h: 100, low24h: 80, high24h: 120,
    bidPrice: 124, askPrice: 125, lastTickerAt: 1000, lastValidUpdateAt: 1000, source: 'REST'
  });
  assert.equal(high.rangePositionPercent, 100);
});

test('trade ids order multiple trades that share the same millisecond', () => {
  const first = applyTrade({ ...createInitialMarketState(), currentPrice: 100 }, {
    currentPrice: 101, lastTradeId: 100, lastTradeAt: 2000, lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const second = applyTrade(first, {
    currentPrice: 102, lastTradeId: 101, lastTradeAt: 2000, lastValidUpdateAt: 2002, source: 'WEBSOCKET'
  });
  const duplicate = applyTrade(second, {
    currentPrice: 99, lastTradeId: 101, lastTradeAt: 2000, lastValidUpdateAt: 3000, source: 'WEBSOCKET'
  });
  const olderId = applyTrade(second, {
    currentPrice: 98, lastTradeId: 99, lastTradeAt: 2000, lastValidUpdateAt: 3000, source: 'WEBSOCKET'
  });

  assert.equal(second.currentPrice, 102);
  assert.equal(second.lastTradeId, 101);
  assert.strictEqual(duplicate, second);
  assert.strictEqual(olderId, second);
});

test('trade price wins over ticker price at the same exchange timestamp', () => {
  const traded = applyTrade({ ...createInitialMarketState(), currentPrice: 100 }, {
    currentPrice: 102, lastTradeId: 10, lastTradeAt: 2000, lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const ticked = applyTicker(traded, {
    currentPrice: 101, high24h: 110, low24h: 90, bidPrice: 100.9, askPrice: 101.1,
    lastTickerAt: 2000, lastValidUpdateAt: 2002, source: 'WEBSOCKET'
  });

  assert.equal(ticked.currentPrice, 102);
  assert.equal(ticked.priceSource, 'TRADE');
  assert.equal(ticked.high24h, 110);
});

test('equal-timestamp REST snapshot cannot replace a live websocket price', () => {
  const live = applyTrade({ ...createInitialMarketState(), currentPrice: 100 }, {
    currentPrice: 102, lastTradeId: 10, lastTradeAt: 2000, lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const merged = applySnapshot(live, {
    currentPrice: 101, open24h: 95, low24h: 90, high24h: 110, bidPrice: 100.9, askPrice: 101.1,
    lastTickerAt: 2000, lastValidUpdateAt: 2002, source: 'REST'
  });

  assert.equal(merged.currentPrice, 102);
  assert.equal(merged.priceSource, 'TRADE');
  assert.equal(merged.source, 'WEBSOCKET');
});

test('equal-timestamp websocket ticker fields beat an equal REST snapshot', () => {
  const live = applyTicker(createInitialMarketState(), {
    currentPrice: 105, priceChange24h: 5, priceChangePercent24h: 5,
    open24h: 100, low24h: 90, high24h: 110, baseVolume24h: 10, quoteVolume24h: 1000,
    bidPrice: 104.9, askPrice: 105.1, lastTickerTradeId: 500,
    lastTickerAt: 2000, lastTickerReceivedAt: 2001, lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const merged = applySnapshot(live, {
    currentPrice: 99, priceChange24h: 1, priceChangePercent24h: 1,
    open24h: 98, low24h: 80, high24h: 101, baseVolume24h: 5, quoteVolume24h: 500,
    bidPrice: 98.9, askPrice: 99.1, lastTickerTradeId: 500,
    lastTickerAt: 2000, lastTickerReceivedAt: 2010, lastValidUpdateAt: 2010, source: 'REST'
  });

  assert.equal(merged.high24h, 110);
  assert.equal(merged.bidPrice, 104.9);
  assert.equal(merged.tickerSource, 'WEBSOCKET');
});

test('same-millisecond ticker sequence advances when its last trade id increases', () => {
  const first = applyTicker(createInitialMarketState(), {
    currentPrice: 100, high24h: 110, low24h: 90, bidPrice: 99.9, askPrice: 100.1,
    lastTickerTradeId: 100, lastTickerAt: 2000, lastTickerReceivedAt: 2001,
    lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const second = applyTicker(first, {
    currentPrice: 101, high24h: 111, low24h: 90, bidPrice: 100.9, askPrice: 101.1,
    lastTickerTradeId: 101, lastTickerAt: 2000, lastTickerReceivedAt: 2002,
    lastValidUpdateAt: 2002, source: 'WEBSOCKET'
  });

  assert.notStrictEqual(second, first);
  assert.equal(second.currentPrice, 101);
  assert.equal(second.lastTickerTradeId, 101);
});

test('ticker price can supersede a trade in the same millisecond when it includes a newer trade id', () => {
  const traded = applyTrade({ ...createInitialMarketState(), currentPrice: 100 }, {
    currentPrice: 101, lastTradeId: 100, lastTradeAt: 2000,
    lastTradeReceivedAt: 2001, lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const ticked = applyTicker(traded, {
    currentPrice: 102, high24h: 110, low24h: 90, bidPrice: 101.9, askPrice: 102.1,
    lastTickerTradeId: 101, lastTickerAt: 2000, lastTickerReceivedAt: 2002,
    lastValidUpdateAt: 2002, source: 'WEBSOCKET'
  });

  assert.equal(ticked.currentPrice, 102);
  assert.equal(ticked.priceSource, 'TICKER');
  assert.equal(ticked.lastPriceTradeId, 101);
});

test('REST price cannot supersede a newer trade id even with a later close timestamp', () => {
  const traded = applyTrade({ ...createInitialMarketState(), currentPrice: 100 }, {
    currentPrice: 102, lastTradeId: 200, lastTradeAt: 2000,
    lastTradeReceivedAt: 2001, lastValidUpdateAt: 2001, source: 'WEBSOCKET'
  });
  const merged = applySnapshot(traded, {
    currentPrice: 99, open24h: 95, low24h: 90, high24h: 110,
    bidPrice: 98.9, askPrice: 99.1, lastTickerTradeId: 199,
    lastTickerAt: 2500, lastTickerReceivedAt: 2501, lastValidUpdateAt: 2501, source: 'REST'
  });

  assert.equal(merged.currentPrice, 102);
  assert.equal(merged.priceSource, 'TRADE');
  assert.equal(merged.lastPriceTradeId, 200);
});

test('freshness uses exchange price time even when receipt time is recent', () => {
  const state = withStatus({
    ...createInitialMarketState(),
    lastPriceEventAt: 1000,
    lastValidUpdateAt: 1000 + STALE_AFTER_MS + 500
  }, CONNECTION_STATUS.LIVE);

  assert.equal(
    deriveFreshnessStatus(state, 1000 + STALE_AFTER_MS + 1),
    CONNECTION_STATUS.STALE
  );
});


test('fresh price with stale 24h statistics is degraded rather than fully stale', () => {
  const now = 20_000;
  const state = withStatus({
    ...createInitialMarketState(),
    lastPriceEventAt: now - 1_000,
    lastTickerAt: now - 9_000
  }, CONNECTION_STATUS.LIVE);

  assert.equal(deriveFreshnessStatus(state, now), CONNECTION_STATUS.DEGRADED);
});

test('fresh ticker data recovers a degraded connection to live', () => {
  const now = 20_000;
  const state = withStatus({
    ...createInitialMarketState(),
    lastPriceEventAt: now - 1_000,
    lastTickerAt: now - 1_500
  }, CONNECTION_STATUS.DEGRADED);

  assert.equal(deriveFreshnessStatus(state, now), CONNECTION_STATUS.LIVE);
});
