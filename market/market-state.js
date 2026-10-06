import { CONNECTION_STATUS } from './connection-state.js';

export { CONNECTION_STATUS };

export const STALE_AFTER_MS = 5000;
export const TICKER_STALE_AFTER_MS = 8000;

export const FEED_STATUS = Object.freeze({
  WAITING: 'WAITING',
  FRESH: 'FRESH',
  STALE: 'STALE'
});

const TICKER_FIELDS = Object.freeze([
  'priceChange24h',
  'priceChangePercent24h',
  'open24h',
  'high24h',
  'low24h',
  'baseVolume24h',
  'quoteVolume24h',
  'bidPrice',
  'askPrice',
  'lastTickerTradeId',
  'lastTickerAt',
  'lastTickerReceivedAt',
  'tickerSource'
]);

const PRICE_SOURCE_PRIORITY = Object.freeze({
  REST: 1,
  TICKER: 2,
  TRADE: 3
});

export function createInitialMarketState() {
  return {
    symbol: 'BTCUSDT',
    currentPrice: null,
    previousPrice: null,
    priceDirection: 'FLAT',
    priceSource: null,
    priceChange24h: null,
    priceChangePercent24h: null,
    open24h: null,
    high24h: null,
    low24h: null,
    baseVolume24h: null,
    quoteVolume24h: null,
    bidPrice: null,
    askPrice: null,
    spreadAbsolute: null,
    spreadPercent: null,
    rangePositionPercent: null,
    lastTradeId: null,
    lastTradeAt: null,
    lastTradeReceivedAt: null,
    lastTickerTradeId: null,
    lastTickerAt: null,
    lastTickerReceivedAt: null,
    lastPriceTradeId: null,
    lastPriceEventAt: null,
    lastPriceReceivedAt: null,
    tickerSource: null,
    lastValidUpdateAt: null,
    connectionStatus: CONNECTION_STATUS.INITIAL,
    source: null,
    hasInitialSnapshot: false,
    errorMessage: null
  };
}

export function applySnapshot(state, snapshot, { preservePrice = false } = {}) {
  const snapshotAt = finiteOrNull(snapshot.lastTickerAt);
  const snapshotTradeId = safeIntegerOrNull(snapshot.lastTickerTradeId);
  const tickerOrder = compareTickerOrder(
    state.lastTickerAt,
    state.lastTickerTradeId,
    snapshotAt,
    snapshotTradeId
  );
  const preserveLiveTicker = state.tickerSource === 'WEBSOCKET' && tickerOrder >= 0;

  let next = { ...state, ...snapshot, tickerSource: 'REST' };

  if (preserveLiveTicker) {
    for (const field of TICKER_FIELDS) next[field] = state[field];
  }

  const snapshotPriceOrder = comparePriceOrder(state, {
    eventAt: snapshotAt,
    tradeId: snapshotTradeId,
    source: 'REST'
  });
  const preserveNewerPrice = preservePrice || snapshotPriceOrder <= 0;
  const previousDisplayedPrice = state.currentPrice;

  if (preserveNewerPrice && Number.isFinite(state.currentPrice)) {
    next.currentPrice = state.currentPrice;
    next.source = state.source;
    next.priceSource = state.priceSource;
    next.lastPriceTradeId = state.lastPriceTradeId;
    next.lastPriceEventAt = state.lastPriceEventAt;
    next.lastPriceReceivedAt = state.lastPriceReceivedAt;
    next.priceDirection = state.priceDirection;
    next.previousPrice = state.previousPrice;
  } else {
    next.currentPrice = snapshot.currentPrice;
    next.previousPrice = previousDisplayedPrice;
    next.priceDirection = getPriceDirection(previousDisplayedPrice, snapshot.currentPrice);
    next.priceSource = 'REST';
    next.lastPriceTradeId = snapshotTradeId;
    next.lastPriceEventAt = snapshotAt;
    next.lastPriceReceivedAt = finiteOrNull(snapshot.lastTickerReceivedAt) ?? finiteOrNull(snapshot.lastValidUpdateAt);
  }

  next.lastValidUpdateAt = maxFinite(state.lastValidUpdateAt, snapshot.lastValidUpdateAt);
  next.hasInitialSnapshot = true;
  next.errorMessage = null;
  return withDerivedValues(next);
}

export function applyTrade(state, trade) {
  const eventAt = finiteOrNull(trade.lastTradeAt);
  const tradeId = safeIntegerOrNull(trade.lastTradeId);
  const priceOrder = comparePriceOrder(state, {
    eventAt,
    tradeId,
    source: 'TRADE'
  });

  if (priceOrder <= 0) return state;

  const previousPrice = state.currentPrice;
  const currentPrice = trade.currentPrice;
  const priceDirection = getPriceDirection(previousPrice, currentPrice);
  return withDerivedValues({
    ...state,
    ...trade,
    previousPrice,
    currentPrice,
    priceDirection,
    priceSource: 'TRADE',
    lastPriceTradeId: tradeId,
    lastPriceEventAt: eventAt ?? state.lastPriceEventAt,
    lastPriceReceivedAt: finiteOrNull(trade.lastTradeReceivedAt) ?? finiteOrNull(trade.lastValidUpdateAt),
    errorMessage: null
  });
}

export function applyTicker(state, ticker) {
  const eventAt = finiteOrNull(ticker.lastTickerAt);
  const tradeId = safeIntegerOrNull(ticker.lastTickerTradeId);
  const tickerOrder = compareTickerOrder(
    state.lastTickerAt,
    state.lastTickerTradeId,
    eventAt,
    tradeId
  );
  if (tickerOrder >= 0) return state;

  const { currentPrice: incomingPrice, source: _incomingSource, ...tickerFields } = ticker;
  const canAdvancePrice = Number.isFinite(incomingPrice) && comparePriceOrder(state, {
    eventAt,
    tradeId,
    source: 'TICKER'
  }) > 0;
  const previousPrice = canAdvancePrice ? state.currentPrice : state.previousPrice;
  const currentPrice = canAdvancePrice ? incomingPrice : state.currentPrice;
  const priceDirection = canAdvancePrice
    ? getPriceDirection(state.currentPrice, incomingPrice)
    : state.priceDirection;

  return withDerivedValues({
    ...state,
    ...tickerFields,
    source: 'WEBSOCKET',
    tickerSource: 'WEBSOCKET',
    currentPrice,
    previousPrice,
    priceDirection,
    priceSource: canAdvancePrice ? 'TICKER' : state.priceSource,
    lastPriceTradeId: canAdvancePrice ? tradeId : state.lastPriceTradeId,
    lastPriceEventAt: canAdvancePrice && eventAt !== null ? eventAt : state.lastPriceEventAt,
    lastPriceReceivedAt: canAdvancePrice
      ? finiteOrNull(ticker.lastTickerReceivedAt) ?? finiteOrNull(ticker.lastValidUpdateAt)
      : state.lastPriceReceivedAt,
    errorMessage: null
  });
}

export function withStatus(state, connectionStatus, errorMessage = null) {
  return { ...state, connectionStatus, errorMessage };
}

export function deriveFeedHealth(state, now = Date.now()) {
  const priceAge = priceEventAgeMs(state, now);
  const tickerAge = tickerEventAgeMs(state, now);
  return {
    price: feedStatus(priceAge, STALE_AFTER_MS),
    stats: feedStatus(tickerAge, TICKER_STALE_AFTER_MS),
    priceAge,
    tickerAge
  };
}

export function deriveFreshnessStatus(state, now = Date.now()) {
  if (![CONNECTION_STATUS.LIVE, CONNECTION_STATUS.DEGRADED, CONNECTION_STATUS.STALE].includes(state.connectionStatus)) {
    return state.connectionStatus;
  }

  const health = deriveFeedHealth(state, now);
  if (health.price === FEED_STATUS.STALE) return CONNECTION_STATUS.STALE;
  if (health.price === FEED_STATUS.FRESH && health.stats === FEED_STATUS.STALE) return CONNECTION_STATUS.DEGRADED;
  if (health.price === FEED_STATUS.FRESH) return CONNECTION_STATUS.LIVE;
  return state.connectionStatus;
}

export function latestExchangeEventAt(state) {
  return maxFinite(state.lastTradeAt, state.lastTickerAt);
}

export function priceEventAgeMs(state, now = Date.now()) {
  return ageMs(state.lastPriceEventAt, now);
}

export function tickerEventAgeMs(state, now = Date.now()) {
  return ageMs(state.lastTickerAt, now);
}

function feedStatus(age, staleAfterMs) {
  if (age === null) return FEED_STATUS.WAITING;
  return age > staleAfterMs ? FEED_STATUS.STALE : FEED_STATUS.FRESH;
}

function comparePriceOrder(state, incoming) {
  const currentTradeId = safeIntegerOrNull(state.lastPriceTradeId);
  const incomingTradeId = safeIntegerOrNull(incoming.tradeId);

  if (currentTradeId !== null && incomingTradeId !== null && currentTradeId !== incomingTradeId) {
    return incomingTradeId > currentTradeId ? 1 : -1;
  }

  const currentAt = finiteOrNull(state.lastPriceEventAt);
  const incomingAt = finiteOrNull(incoming.eventAt);
  if (currentAt !== null && incomingAt !== null && currentAt !== incomingAt) {
    return incomingAt > currentAt ? 1 : -1;
  }

  if (currentAt === null && incomingAt !== null) return 1;
  if (currentAt !== null && incomingAt === null) return -1;
  if (currentTradeId === null && incomingTradeId !== null) return 1;
  if (currentTradeId !== null && incomingTradeId === null) return -1;

  const currentPriority = PRICE_SOURCE_PRIORITY[state.priceSource] ?? 0;
  const incomingPriority = PRICE_SOURCE_PRIORITY[incoming.source] ?? 0;
  return Math.sign(incomingPriority - currentPriority);
}

function compareTickerOrder(currentAtValue, currentTradeIdValue, incomingAtValue, incomingTradeIdValue) {
  const currentAt = finiteOrNull(currentAtValue);
  const incomingAt = finiteOrNull(incomingAtValue);
  if (currentAt !== null && incomingAt !== null && currentAt !== incomingAt) {
    return currentAt > incomingAt ? 1 : -1;
  }
  if (currentAt === null && incomingAt !== null) return -1;
  if (currentAt !== null && incomingAt === null) return 1;

  const currentTradeId = safeIntegerOrNull(currentTradeIdValue);
  const incomingTradeId = safeIntegerOrNull(incomingTradeIdValue);
  if (currentTradeId !== null && incomingTradeId !== null && currentTradeId !== incomingTradeId) {
    return currentTradeId > incomingTradeId ? 1 : -1;
  }
  if (currentTradeId === null && incomingTradeId !== null) return -1;
  if (currentTradeId !== null && incomingTradeId === null) return 1;
  return 0;
}

function getPriceDirection(previousPrice, currentPrice) {
  if (!Number.isFinite(previousPrice) || !Number.isFinite(currentPrice) || currentPrice === previousPrice) return 'FLAT';
  return currentPrice > previousPrice ? 'UP' : 'DOWN';
}

function maxFinite(left, right) {
  if (Number.isFinite(left) && Number.isFinite(right)) return Math.max(left, right);
  if (Number.isFinite(right)) return right;
  return Number.isFinite(left) ? left : null;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function safeIntegerOrNull(value) {
  return Number.isSafeInteger(value) ? value : null;
}

function ageMs(timestamp, now) {
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, now - timestamp);
}

function withDerivedValues(state) {
  const bid = state.bidPrice;
  const ask = state.askPrice;
  const current = state.currentPrice;
  const low = state.low24h;
  const high = state.high24h;

  let spreadAbsolute = null;
  let spreadPercent = null;
  if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask >= bid) {
    spreadAbsolute = ask - bid;
    const midpoint = (ask + bid) / 2;
    spreadPercent = midpoint > 0 ? (spreadAbsolute / midpoint) * 100 : null;
  }

  let rangePositionPercent = null;
  if (Number.isFinite(current) && Number.isFinite(low) && Number.isFinite(high) && high >= low) {
    if (high === low) rangePositionPercent = 50;
    else rangePositionPercent = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100));
  }

  return { ...state, spreadAbsolute, spreadPercent, rangePositionPercent };
}
