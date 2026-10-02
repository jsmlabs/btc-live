import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONNECTION_STATUS,
  STALE_AFTER_MS,
  applySnapshot,
  applyTicker,
  applyTrade,
  createInitialMarketState,
  deriveFreshnessStatus,
  withStatus
} from '../src/market/market-state.js';

test('creates deterministic initial state', () => {
  const state = createInitialMarketState();
  assert.equal(state.connectionStatus, CONNECTION_STATUS.INITIAL);
  assert.equal(state.symbol, 'BTCUSDT');
  assert.equal(state.currentPrice, null);
});

test('snapshot marks initial data available and derives spread', () => {
  const state = applySnapshot(createInitialMarketState(), {
    currentPrice: 100,
    bidPrice: 99.5,
    askPrice: 100.5,
    lastValidUpdateAt: 1000
  });
  assert.equal(state.hasInitialSnapshot, true);
  assert.equal(state.spreadAbsolute, 1);
  assert.equal(state.spreadPercent, 1);
});

test('trade tracks previous price and direction', () => {
  let state = applySnapshot(createInitialMarketState(), { currentPrice: 100 });
  state = applyTrade(state, { currentPrice: 101, lastTradeAt: 10, lastValidUpdateAt: 10 });
  assert.equal(state.previousPrice, 100);
  assert.equal(state.currentPrice, 101);
  assert.equal(state.priceDirection, 'UP');
});

test('ticker updates market statistics without replacing current price', () => {
  let state = applySnapshot(createInitialMarketState(), { currentPrice: 100 });
  state = applyTicker(state, { high24h: 110, low24h: 90, bidPrice: 99.9, askPrice: 100.1 });
  assert.equal(state.currentPrice, 100);
  assert.equal(state.high24h, 110);
  assert.ok(Math.abs(state.spreadAbsolute - 0.2) < 1e-9);
});

test('live state becomes stale after freshness threshold', () => {
  const state = withStatus({ ...createInitialMarketState(), lastValidUpdateAt: 1000 }, CONNECTION_STATUS.LIVE);
  assert.equal(deriveFreshnessStatus(state, 1000 + STALE_AFTER_MS), CONNECTION_STATUS.LIVE);
  assert.equal(deriveFreshnessStatus(state, 1001 + STALE_AFTER_MS), CONNECTION_STATUS.STALE);
});
