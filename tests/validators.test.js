import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeBookTickerEvent,
  normalizeRestBookTicker,
  normalizeRestTicker,
  normalizeTickerEvent,
  normalizeTradeEvent
} from '../market/validators.js';

const NOW = 1_800_000_000_000;

function restTickerPayload(overrides = {}) {
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
    closeTime: NOW - 100,
    lastId: 123456,
    ...overrides
  };
}

function restBookPayload(overrides = {}) {
  return {
    symbol: 'BTCUSDT',
    bidPrice: '99999.90',
    bidQty: '1.5',
    askPrice: '100000.10',
    askQty: '1.2',
    time: NOW - 80,
    ...overrides
  };
}

test('normalizeRestTicker validates and normalizes Binance Futures 24h ticker data', () => {
  const value = normalizeRestTicker(restTickerPayload(), NOW);
  assert.equal(value.currentPrice, 100000);
  assert.equal(value.high24h, 101000);
  assert.equal(value.source, 'REST');
  assert.equal(value.lastValidUpdateAt, NOW);
});

test('normalizeRestBookTicker validates Futures top of book independently from 24h ticker', () => {
  const value = normalizeRestBookTicker(restBookPayload(), NOW);
  assert.equal(value.bidPrice, 99999.9);
  assert.equal(value.askPrice, 100000.1);
  assert.equal(value.bookSource, 'REST');
  assert.equal(normalizeRestBookTicker(restBookPayload({ bidPrice: '100001', askPrice: '100000' }), NOW), null);
  assert.equal(normalizeRestBookTicker(restBookPayload({ symbol: 'ETHUSDT' }), NOW), null);
});

test('normalizeRestTicker rejects invalid symbols', () => {
  assert.equal(normalizeRestTicker(restTickerPayload({ symbol: 'ETHUSDT' }), NOW), null);
});

test('normalizeTradeEvent rejects implausible Futures aggregate-trade timestamps', () => {
  const payload = { e: 'aggTrade', s: 'BTCUSDT', p: '100100', a: 42, T: NOW - 49 * 60 * 60 * 1000 };
  assert.equal(normalizeTradeEvent(payload, NOW), null);
});

test('normalizeTickerEvent includes the Futures ticker last price', () => {
  const payload = {
    e: '24hrTicker', s: 'BTCUSDT', c: '100200', p: '1300', P: '1.31', o: '98900',
    h: '101500', l: '98000', v: '1300', q: '130000000', E: NOW - 50, L: 123456
  };
  const value = normalizeTickerEvent(payload, NOW);
  assert.equal(value.currentPrice, 100200);
  assert.equal(value.source, 'WEBSOCKET');
  assert.equal(value.open24h, 98900);
});

test('normalizeBookTickerEvent validates Futures top-of-book stream data', () => {
  const payload = {
    e: 'bookTicker', E: NOW - 20, T: NOW - 21, s: 'BTCUSDT',
    b: '100199.9', B: '0.8', a: '100200.1', A: '1.1'
  };
  const value = normalizeBookTickerEvent(payload, NOW);
  assert.equal(value.bidPrice, 100199.9);
  assert.equal(value.askPrice, 100200.1);
  assert.equal(value.bookSource, 'WEBSOCKET');
});

test('websocket validators reject delayed events beyond the live freshness window', () => {
  const trade = { e: 'aggTrade', s: 'BTCUSDT', p: '100100', a: 42, T: NOW - 30_001 };
  const book = { e: 'bookTicker', s: 'BTCUSDT', b: '100099', a: '100101', E: NOW - 30_001 };
  assert.equal(normalizeTradeEvent(trade, NOW), null);
  assert.equal(normalizeBookTickerEvent(book, NOW), null);
});

test('normalizeTradeEvent requires a safe non-negative aggregate trade id', () => {
  const base = { e: 'aggTrade', s: 'BTCUSDT', p: '100100', T: NOW - 10 };
  assert.equal(normalizeTradeEvent(base, NOW), null);
  assert.equal(normalizeTradeEvent({ ...base, a: -1 }, NOW), null);
  const value = normalizeTradeEvent({ ...base, a: 987654321 }, NOW);
  assert.equal(value.lastTradeId, 987654321);
});

test('ticker validators reject internally inconsistent 24h ranges', () => {
  assert.equal(normalizeRestTicker(restTickerPayload({ lastPrice: '102000.00', highPrice: '101000.00' }), NOW), null);
  const ticker = {
    e: '24hrTicker', s: 'BTCUSDT', c: '100200', p: '1300', P: '1.31', o: '102000',
    h: '101500', l: '98000', v: '1300', q: '130000000', E: NOW - 50, L: 123456
  };
  assert.equal(normalizeTickerEvent(ticker, NOW), null);
});

test('ticker validators require Binance Futures sequencing metadata', () => {
  assert.equal(normalizeRestTicker(restTickerPayload({ lastId: undefined }), NOW), null);
  assert.equal(normalizeRestTicker(restTickerPayload({ closeTime: undefined }), NOW), null);

  const ticker = {
    e: '24hrTicker', s: 'BTCUSDT', c: '100200', p: '1300', P: '1.31', o: '98900',
    h: '101500', l: '98000', v: '1300', q: '130000000', E: NOW - 50
  };
  assert.equal(normalizeTickerEvent(ticker, NOW), null);
});

test('ticker validators reject internally inconsistent 24h change values', () => {
  assert.equal(normalizeRestTicker(restTickerPayload({ priceChange: '999.00' }), NOW), null);
  assert.equal(normalizeRestTicker(restTickerPayload({ priceChangePercent: '9.99' }), NOW), null);

  const ticker = {
    e: '24hrTicker', s: 'BTCUSDT', c: '100200', p: '900', P: '1.31', o: '98900',
    h: '101500', l: '98000', v: '1300', q: '130000000', E: NOW - 50, L: 123456
  };
  assert.equal(normalizeTickerEvent(ticker, NOW), null);
});
