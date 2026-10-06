import { isRecentTimestamp } from '../utils/time.js';

export const SYMBOL = 'BTCUSDT';
const MAX_WEBSOCKET_EVENT_AGE_MS = 30_000;
const MAX_REST_EVENT_AGE_MS = 120_000;

function toFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toSafeInteger(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function isValidBook(bidPrice, askPrice) {
  return bidPrice !== null && askPrice !== null && bidPrice > 0 && askPrice > 0 && askPrice >= bidPrice;
}

function isValidRange(lowPrice, highPrice) {
  return lowPrice !== null && highPrice !== null && lowPrice > 0 && highPrice >= lowPrice;
}

function isPriceInsideRange(price, lowPrice, highPrice) {
  return price !== null && price >= lowPrice && price <= highPrice;
}

function approximatelyEqual(left, right, absoluteTolerance, relativeTolerance = 0) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const tolerance = Math.max(absoluteTolerance, Math.max(Math.abs(left), Math.abs(right)) * relativeTolerance);
  return Math.abs(left - right) <= tolerance;
}

function isValidChange(currentPrice, openPrice, priceChange, priceChangePercent) {
  const expectedChange = currentPrice - openPrice;
  if (!approximatelyEqual(priceChange, expectedChange, 0.02, 1e-8)) return false;
  const expectedPercent = openPrice > 0 ? (expectedChange / openPrice) * 100 : null;
  return expectedPercent !== null && approximatelyEqual(priceChangePercent, expectedPercent, 0.02, 1e-7);
}

export function normalizeRestTicker(payload, now = Date.now()) {
  if (!payload || payload.symbol !== SYMBOL) return null;

  const lastPrice = toFiniteNumber(payload.lastPrice);
  const priceChange = toFiniteNumber(payload.priceChange);
  const priceChangePercent = toFiniteNumber(payload.priceChangePercent);
  const openPrice = toFiniteNumber(payload.openPrice);
  const highPrice = toFiniteNumber(payload.highPrice);
  const lowPrice = toFiniteNumber(payload.lowPrice);
  const baseVolume = toFiniteNumber(payload.volume);
  const quoteVolume = toFiniteNumber(payload.quoteVolume);
  const closeTime = toFiniteNumber(payload.closeTime);
  const lastTradeId = toSafeInteger(payload.lastId);

  if (lastPrice === null || lastPrice <= 0) return null;
  if (priceChange === null || priceChangePercent === null) return null;
  if (openPrice === null || openPrice <= 0) return null;
  if (!isValidChange(lastPrice, openPrice, priceChange, priceChangePercent)) return null;
  if (!isValidRange(lowPrice, highPrice)) return null;
  if (!isPriceInsideRange(lastPrice, lowPrice, highPrice) || !isPriceInsideRange(openPrice, lowPrice, highPrice)) return null;
  if (baseVolume === null || quoteVolume === null || baseVolume < 0 || quoteVolume < 0) return null;
  if (closeTime === null || !isRecentTimestamp(closeTime, now, MAX_REST_EVENT_AGE_MS)) return null;
  if (lastTradeId === null || lastTradeId < 0) return null;

  return {
    symbol: SYMBOL,
    currentPrice: lastPrice,
    priceChange24h: priceChange,
    priceChangePercent24h: priceChangePercent,
    open24h: openPrice,
    high24h: highPrice,
    low24h: lowPrice,
    baseVolume24h: baseVolume,
    quoteVolume24h: quoteVolume,
    lastTickerTradeId: lastTradeId,
    lastTickerAt: closeTime,
    lastTickerReceivedAt: now,
    lastValidUpdateAt: now,
    source: 'REST'
  };
}

export function normalizeRestBookTicker(payload, now = Date.now()) {
  if (!payload || payload.symbol !== SYMBOL) return null;

  const bidPrice = toFiniteNumber(payload.bidPrice);
  const askPrice = toFiniteNumber(payload.askPrice);
  const eventTime = toFiniteNumber(payload.time);

  if (!isValidBook(bidPrice, askPrice)) return null;
  if (eventTime === null || !isRecentTimestamp(eventTime, now, MAX_REST_EVENT_AGE_MS)) return null;

  return {
    symbol: SYMBOL,
    bidPrice,
    askPrice,
    lastBookAt: eventTime,
    lastBookReceivedAt: now,
    lastValidUpdateAt: now,
    bookSource: 'REST'
  };
}

export function normalizeTradeEvent(payload, now = Date.now()) {
  if (!payload || payload.e !== 'aggTrade' || payload.s !== SYMBOL) return null;

  const price = toFiniteNumber(payload.p);
  const tradeId = toSafeInteger(payload.a);
  const tradeTime = toFiniteNumber(payload.T);

  if (price === null || price <= 0) return null;
  if (tradeId === null || tradeId < 0) return null;
  if (tradeTime === null || !isRecentTimestamp(tradeTime, now, MAX_WEBSOCKET_EVENT_AGE_MS)) return null;

  return {
    symbol: SYMBOL,
    currentPrice: price,
    lastTradeId: tradeId,
    lastTradeAt: tradeTime,
    lastTradeReceivedAt: now,
    lastValidUpdateAt: now,
    source: 'WEBSOCKET'
  };
}

export function normalizeTickerEvent(payload, now = Date.now()) {
  if (!payload || payload.e !== '24hrTicker' || payload.s !== SYMBOL) return null;

  const currentPrice = toFiniteNumber(payload.c);
  const priceChange = toFiniteNumber(payload.p);
  const priceChangePercent = toFiniteNumber(payload.P);
  const openPrice = toFiniteNumber(payload.o);
  const highPrice = toFiniteNumber(payload.h);
  const lowPrice = toFiniteNumber(payload.l);
  const baseVolume = toFiniteNumber(payload.v);
  const quoteVolume = toFiniteNumber(payload.q);
  const eventTime = toFiniteNumber(payload.E);
  const lastTradeId = toSafeInteger(payload.L);

  if (currentPrice === null || currentPrice <= 0) return null;
  if (priceChange === null || priceChangePercent === null) return null;
  if (openPrice === null || openPrice <= 0) return null;
  if (!isValidChange(currentPrice, openPrice, priceChange, priceChangePercent)) return null;
  if (!isValidRange(lowPrice, highPrice)) return null;
  if (!isPriceInsideRange(currentPrice, lowPrice, highPrice) || !isPriceInsideRange(openPrice, lowPrice, highPrice)) return null;
  if (baseVolume === null || quoteVolume === null || baseVolume < 0 || quoteVolume < 0) return null;
  if (eventTime === null || !isRecentTimestamp(eventTime, now, MAX_WEBSOCKET_EVENT_AGE_MS)) return null;
  if (lastTradeId === null || lastTradeId < 0) return null;

  return {
    symbol: SYMBOL,
    currentPrice,
    priceChange24h: priceChange,
    priceChangePercent24h: priceChangePercent,
    open24h: openPrice,
    high24h: highPrice,
    low24h: lowPrice,
    baseVolume24h: baseVolume,
    quoteVolume24h: quoteVolume,
    lastTickerTradeId: lastTradeId,
    lastTickerAt: eventTime,
    lastTickerReceivedAt: now,
    lastValidUpdateAt: now,
    source: 'WEBSOCKET'
  };
}

export function normalizeBookTickerEvent(payload, now = Date.now()) {
  if (!payload || payload.e !== 'bookTicker' || payload.s !== SYMBOL) return null;

  const bidPrice = toFiniteNumber(payload.b);
  const askPrice = toFiniteNumber(payload.a);
  const eventTime = toFiniteNumber(payload.E);

  if (!isValidBook(bidPrice, askPrice)) return null;
  if (eventTime === null || !isRecentTimestamp(eventTime, now, MAX_WEBSOCKET_EVENT_AGE_MS)) return null;

  return {
    symbol: SYMBOL,
    bidPrice,
    askPrice,
    lastBookAt: eventTime,
    lastBookReceivedAt: now,
    lastValidUpdateAt: now,
    bookSource: 'WEBSOCKET'
  };
}
