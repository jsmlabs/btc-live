import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRestTicker, normalizeTickerEvent, normalizeTradeEvent } from '../src/market/validators.js';

const NOW = 1_700_000_000_000;

test('normalizes a valid REST ticker snapshot', () => {
  const result = normalizeRestTicker({
    symbol: 'BTCUSDT',
    lastPrice: '85742.31',
    priceChange: '1203.54',
    priceChangePercent: '1.42',
    highPrice: '86410.20',
    lowPrice: '83921.10',
    volume: '11200.5',
    quoteVolume: '960000000.12',
    bidPrice: '85741.90',
    askPrice: '85742.40',
    closeTime: NOW
  }, NOW);

  assert.equal(result.currentPrice, 85742.31);
  assert.equal(result.quoteVolume24h, 960000000.12);
  assert.equal(result.source, 'REST');
});

test('rejects REST snapshots with invalid spread geometry', () => {
  const result = normalizeRestTicker({
    symbol: 'BTCUSDT', lastPrice: '10', priceChange: '1', priceChangePercent: '1',
    highPrice: '11', lowPrice: '9', volume: '5', quoteVolume: '50',
    bidPrice: '10.2', askPrice: '10.1', closeTime: NOW
  }, NOW);
  assert.equal(result, null);
});

test('normalizes valid trade event and rejects wrong symbol', () => {
  assert.deepEqual(normalizeTradeEvent({ e: 'trade', s: 'BTCUSDT', p: '85742.31', T: NOW }, NOW), {
    symbol: 'BTCUSDT', currentPrice: 85742.31, lastTradeAt: NOW, lastValidUpdateAt: NOW, source: 'WEBSOCKET'
  });
  assert.equal(normalizeTradeEvent({ e: 'trade', s: 'ETHUSDT', p: '3000', T: NOW }, NOW), null);
});

test('normalizes valid 24h ticker event', () => {
  const result = normalizeTickerEvent({
    e: '24hrTicker', E: NOW, s: 'BTCUSDT', p: '1203.54', P: '1.42',
    h: '86410.20', l: '83921.10', v: '11200.5', q: '960000000.12',
    b: '85741.90', a: '85742.40'
  }, NOW);
  assert.equal(result.priceChangePercent24h, 1.42);
  assert.equal(result.askPrice, 85742.4);
});

test('rejects malformed numeric values', () => {
  assert.equal(normalizeTradeEvent({ e: 'trade', s: 'BTCUSDT', p: 'NaN', T: NOW }, NOW), null);
});
