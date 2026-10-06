import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRestTicker, normalizeTickerEvent, normalizeTradeEvent } from '../market/validators.js';

const NOW = 1_800_000_000_000;

function restPayload(overrides = {}) {
  return {
    symbol: 'BTCUSDT',
    lastPrice: '100000.00',
    priceChange: '1200.00',
    priceChangePercent: '1.21',
    openPrice: '98800.00',
    highPrice: '101000.00',
    lowPrice: '98000.00',
    volume: '1234.5',
    quoteVolume: '123450000.00',
    bidPrice: '99999.90',
    askPrice: '100000.10',
    closeTime: NOW - 100,
    lastId: 123456,
    ...overrides
  };
}

test('normalizeRestTicker validates and normalizes Binance data', () => {
  const value = normalizeRestTicker(restPayload(), NOW);
  assert.equal(value.currentPrice, 100000);
  assert.equal(value.bidPrice, 99999.9);
  assert.equal(value.source, 'REST');
  assert.equal(value.lastValidUpdateAt, NOW);
});

test('normalizeRestTicker rejects crossed order books and invalid symbols', () => {
  assert.equal(normalizeRestTicker(restPayload({ bidPrice: '100001', askPrice: '100000' }), NOW), null);
  assert.equal(normalizeRestTicker(restPayload({ symbol: 'ETHUSDT' }), NOW), null);
});

test('normalizeTradeEvent rejects implausible timestamps', () => {
  const payload = { e: 'trade', s: 'BTCUSDT', p: '100100', t: 42, T: NOW - 49 * 60 * 60 * 1000 };
  assert.equal(normalizeTradeEvent(payload, NOW), null);
});

test('normalizeTickerEvent includes the ticker last price', () => {
  const payload = {
    e: '24hrTicker', s: 'BTCUSDT', c: '100200', p: '1300', P: '1.31', o: '98900',
    h: '101500', l: '98000', v: '1300', q: '130000000',
    b: '100199.9', a: '100200.1', E: NOW - 50, L: 123456
  };
  const value = normalizeTickerEvent(payload, NOW);
  assert.equal(value.currentPrice, 100200);
  assert.equal(value.source, 'WEBSOCKET');
  assert.equal(value.open24h, 98900);
});

test('websocket validators reject delayed events beyond the live freshness window', () => {
  const trade = { e: 'trade', s: 'BTCUSDT', p: '100100', t: 42, T: NOW - 30_001 };
  assert.equal(normalizeTradeEvent(trade, NOW), null);
});


test('normalizeTradeEvent requires a safe non-negative trade id', () => {
  const base = { e: 'trade', s: 'BTCUSDT', p: '100100', T: NOW - 10 };
  assert.equal(normalizeTradeEvent(base, NOW), null);
  assert.equal(normalizeTradeEvent({ ...base, t: -1 }, NOW), null);
  const value = normalizeTradeEvent({ ...base, t: 987654321 }, NOW);
  assert.equal(value.lastTradeId, 987654321);
});

test('ticker validators reject internally inconsistent 24h ranges', () => {
  assert.equal(normalizeRestTicker(restPayload({ lastPrice: '102000.00', highPrice: '101000.00' }), NOW), null);
  const ticker = {
    e: '24hrTicker', s: 'BTCUSDT', c: '100200', p: '1300', P: '1.31', o: '102000',
    h: '101500', l: '98000', v: '1300', q: '130000000',
    b: '100199.9', a: '100200.1', E: NOW - 50, L: 123456
  };
  assert.equal(normalizeTickerEvent(ticker, NOW), null);
});

test('ticker validators require Binance sequencing metadata', () => {
  assert.equal(normalizeRestTicker(restPayload({ lastId: undefined }), NOW), null);
  assert.equal(normalizeRestTicker(restPayload({ closeTime: undefined }), NOW), null);

  const ticker = {
    e: '24hrTicker', s: 'BTCUSDT', c: '100200', p: '1300', P: '1.31', o: '98900',
    h: '101500', l: '98000', v: '1300', q: '130000000',
    b: '100199.9', a: '100200.1', E: NOW - 50
  };
  assert.equal(normalizeTickerEvent(ticker, NOW), null);
});

test('ticker validators reject internally inconsistent 24h change values', () => {
  assert.equal(normalizeRestTicker(restPayload({ priceChange: '999.00' }), NOW), null);
  assert.equal(normalizeRestTicker(restPayload({ priceChangePercent: '9.99' }), NOW), null);

  const ticker = {
    e: '24hrTicker', s: 'BTCUSDT', c: '100200', p: '900', P: '1.31', o: '98900',
    h: '101500', l: '98000', v: '1300', q: '130000000',
    b: '100199.9', a: '100200.1', E: NOW - 50, L: 123456
  };
  assert.equal(normalizeTickerEvent(ticker, NOW), null);
});
