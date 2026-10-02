import { isPlausibleTimestamp } from '../utils/time.js';

export const SYMBOL = 'BTCUSDT';

function toFiniteNumber(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeRestTicker(payload, now = Date.now()) {
  if (!payload || payload.symbol !== SYMBOL) return null;

  const lastPrice = toFiniteNumber(payload.lastPrice);
  const priceChange = toFiniteNumber(payload.priceChange);
  const priceChangePercent = toFiniteNumber(payload.priceChangePercent);
  const highPrice = toFiniteNumber(payload.highPrice);
  const lowPrice = toFiniteNumber(payload.lowPrice);
  const baseVolume = toFiniteNumber(payload.volume);
  const quoteVolume = toFiniteNumber(payload.quoteVolume);
  const bidPrice = toFiniteNumber(payload.bidPrice);
  const askPrice = toFiniteNumber(payload.askPrice);
  const closeTime = toFiniteNumber(payload.closeTime) ?? now;

  if (lastPrice === null || lastPrice <= 0) return null;
  if (priceChange === null || priceChangePercent === null) return null;
  if (highPrice === null || lowPrice === null || highPrice < lowPrice) return null;
  if (baseVolume === null || quoteVolume === null || baseVolume < 0 || quoteVolume < 0) return null;
  if (bidPrice === null || askPrice === null || bidPrice <= 0 || askPrice <= 0 || askPrice < bidPrice) return null;
  if (!isPlausibleTimestamp(closeTime, now)) return null;

  return {
    symbol: SYMBOL,
    currentPrice: lastPrice,
    priceChange24h: priceChange,
    priceChangePercent24h: priceChangePercent,
    high24h: highPrice,
    low24h: lowPrice,
    baseVolume24h: baseVolume,
    quoteVolume24h: quoteVolume,
    bidPrice,
    askPrice,
    lastTickerAt: closeTime,
    lastValidUpdateAt: now,
    source: 'REST'
  };
}

export function normalizeTradeEvent(payload, now = Date.now()) {
  if (!payload || payload.e !== 'trade' || payload.s !== SYMBOL) return null;
  const price = toFiniteNumber(payload.p);
  const tradeTime = toFiniteNumber(payload.T);
  if (price === null || price <= 0) return null;
  if (tradeTime === null || !isPlausibleTimestamp(tradeTime, now)) return null;
  return {
    symbol: SYMBOL,
    currentPrice: price,
    lastTradeAt: tradeTime,
    lastValidUpdateAt: now,
    source: 'WEBSOCKET'
  };
}

export function normalizeTickerEvent(payload, now = Date.now()) {
  if (!payload || payload.e !== '24hrTicker' || payload.s !== SYMBOL) return null;

  const priceChange = toFiniteNumber(payload.p);
  const priceChangePercent = toFiniteNumber(payload.P);
  const highPrice = toFiniteNumber(payload.h);
  const lowPrice = toFiniteNumber(payload.l);
  const baseVolume = toFiniteNumber(payload.v);
  const quoteVolume = toFiniteNumber(payload.q);
  const bidPrice = toFiniteNumber(payload.b);
  const askPrice = toFiniteNumber(payload.a);
  const eventTime = toFiniteNumber(payload.E);

  if (priceChange === null || priceChangePercent === null) return null;
  if (highPrice === null || lowPrice === null || highPrice < lowPrice) return null;
  if (baseVolume === null || quoteVolume === null || baseVolume < 0 || quoteVolume < 0) return null;
  if (bidPrice === null || askPrice === null || bidPrice <= 0 || askPrice <= 0 || askPrice < bidPrice) return null;
  if (eventTime === null || !isPlausibleTimestamp(eventTime, now)) return null;

  return {
    symbol: SYMBOL,
    priceChange24h: priceChange,
    priceChangePercent24h: priceChangePercent,
    high24h: highPrice,
    low24h: lowPrice,
    baseVolume24h: baseVolume,
    quoteVolume24h: quoteVolume,
    bidPrice,
    askPrice,
    lastTickerAt: eventTime,
    lastValidUpdateAt: now,
    source: 'WEBSOCKET'
  };
}
