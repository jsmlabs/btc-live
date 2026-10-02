export const CONNECTION_STATUS = Object.freeze({
  INITIAL: 'INITIAL',
  LOADING: 'LOADING',
  CONNECTING: 'CONNECTING',
  LIVE: 'LIVE',
  STALE: 'STALE',
  RECONNECTING: 'RECONNECTING',
  OFFLINE: 'OFFLINE',
  ERROR: 'ERROR'
});

export const STALE_AFTER_MS = 5000;

export function createInitialMarketState() {
  return {
    symbol: 'BTCUSDT',
    currentPrice: null,
    previousPrice: null,
    priceDirection: 'FLAT',
    priceChange24h: null,
    priceChangePercent24h: null,
    high24h: null,
    low24h: null,
    baseVolume24h: null,
    quoteVolume24h: null,
    bidPrice: null,
    askPrice: null,
    spreadAbsolute: null,
    spreadPercent: null,
    lastTradeAt: null,
    lastTickerAt: null,
    lastValidUpdateAt: null,
    connectionStatus: CONNECTION_STATUS.INITIAL,
    source: null,
    hasInitialSnapshot: false,
    errorMessage: null
  };
}

export function applySnapshot(state, snapshot) {
  const next = { ...state, ...snapshot, hasInitialSnapshot: true, errorMessage: null };
  return withDerivedValues(next);
}

export function applyTrade(state, trade) {
  const previousPrice = state.currentPrice;
  const currentPrice = trade.currentPrice;
  const priceDirection = previousPrice === null || currentPrice === previousPrice
    ? 'FLAT'
    : currentPrice > previousPrice ? 'UP' : 'DOWN';
  return withDerivedValues({ ...state, ...trade, previousPrice, currentPrice, priceDirection, errorMessage: null });
}

export function applyTicker(state, ticker) {
  return withDerivedValues({ ...state, ...ticker, errorMessage: null });
}

export function withStatus(state, connectionStatus, errorMessage = null) {
  return { ...state, connectionStatus, errorMessage };
}

export function deriveFreshnessStatus(state, now = Date.now()) {
  if (!Number.isFinite(state.lastValidUpdateAt)) return state.connectionStatus;
  if (state.connectionStatus === CONNECTION_STATUS.LIVE && now - state.lastValidUpdateAt > STALE_AFTER_MS) {
    return CONNECTION_STATUS.STALE;
  }
  return state.connectionStatus;
}

function withDerivedValues(state) {
  const bid = state.bidPrice;
  const ask = state.askPrice;
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid) {
    return { ...state, spreadAbsolute: null, spreadPercent: null };
  }
  const spreadAbsolute = ask - bid;
  const midpoint = (ask + bid) / 2;
  const spreadPercent = midpoint > 0 ? (spreadAbsolute / midpoint) * 100 : null;
  return { ...state, spreadAbsolute, spreadPercent };
}
