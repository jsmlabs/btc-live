import {
  DEFAULT_KLINE_LIMIT,
  KLINE_REFRESH_MS,
  fetchBtcKlines,
  intervalMs
} from '../market/binance-klines.js';
import {
  DEFAULT_CHART_PREFERENCES,
  loadChartPreferences,
  saveChartPreferences,
  sanitizeChartPreferences
} from '../storage/chart-preferences.js';

export const CHART_STATUS = Object.freeze({
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  READY: 'READY',
  ERROR: 'ERROR'
});

export function createBtcChartRuntime({
  onChange = () => {},
  onWarning = () => {},
  fetchKlines = fetchBtcKlines,
  loadPreferences = loadChartPreferences,
  persistPreferences = saveChartPreferences,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  now = Date.now,
  limit = DEFAULT_KLINE_LIMIT,
  refreshMs = KLINE_REFRESH_MS
} = {}) {
  if (!Number.isSafeInteger(limit) || limit < 30 || limit > 500) {
    throw new RangeError('limit must be an integer between 30 and 500');
  }
  if (!Number.isFinite(refreshMs) || refreshMs < 5000) {
    throw new RangeError('refreshMs must be at least 5000ms');
  }
  if (typeof fetchKlines !== 'function' || typeof loadPreferences !== 'function' || typeof persistPreferences !== 'function') {
    throw new TypeError('chart runtime data adapters must be functions');
  }
  if (typeof setIntervalFn !== 'function' || typeof clearIntervalFn !== 'function' || typeof now !== 'function') {
    throw new TypeError('chart runtime timing adapters must be functions');
  }

  let preferences = { ...DEFAULT_CHART_PREFERENCES };
  let candles = [];
  let status = CHART_STATUS.IDLE;
  let errorMessage = null;
  let lastLoadedAt = null;
  let lastLivePriceKey = null;
  let refreshTimer = null;
  let requestController = null;
  let requestGeneration = 0;
  let started = false;
  let disposed = false;

  function snapshot() {
    return {
      preferences: { ...preferences },
      candles: candles.map((candle) => ({ ...candle })),
      status,
      errorMessage,
      lastLoadedAt,
      disposed
    };
  }

  function emit() {
    if (!disposed) onChange(snapshot());
  }

  async function start() {
    if (started || disposed) return snapshot();
    started = true;
    try {
      preferences = sanitizeChartPreferences(await loadPreferences());
    } catch (error) {
      onWarning('BTC Live chart preferences could not be loaded', error);
      preferences = { ...DEFAULT_CHART_PREFERENCES };
    }
    emit();
    await reload();
    if (!disposed) {
      refreshTimer = setIntervalFn(() => {
        reload({ background: true }).catch((error) => onWarning('BTC Live chart refresh failed', error));
      }, refreshMs);
    }
    return snapshot();
  }

  async function reload({ background = false } = {}) {
    if (disposed) return snapshot();
    const generation = ++requestGeneration;
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;

    if (!background || candles.length === 0) {
      status = CHART_STATUS.LOADING;
      errorMessage = null;
      emit();
    }

    try {
      const nextCandles = await fetchKlines({
        interval: preferences.interval,
        limit,
        signal: controller.signal
      });
      if (disposed || requestController !== controller || generation !== requestGeneration) return snapshot();
      candles = nextCandles.slice(-limit);
      status = CHART_STATUS.READY;
      errorMessage = null;
      lastLoadedAt = now();
      emit();
    } catch (error) {
      if (disposed || controller.signal.aborted || error?.name === 'AbortError') return snapshot();
      if (candles.length === 0) status = CHART_STATUS.ERROR;
      errorMessage = candles.length === 0 ? 'Unable to load chart data.' : 'Chart refresh delayed.';
      emit();
      if (background) onWarning('BTC Live chart background refresh failed', error);
    } finally {
      if (requestController === controller) requestController = null;
    }
    return snapshot();
  }

  async function updatePreferences(patch) {
    if (disposed) return preferences;
    const previousInterval = preferences.interval;
    preferences = sanitizeChartPreferences({ ...preferences, ...patch });
    emit();
    try {
      preferences = sanitizeChartPreferences(await persistPreferences(preferences));
    } catch (error) {
      onWarning('BTC Live chart preferences could not be saved', error);
    }
    if (preferences.interval !== previousInterval) await reload();
    else emit();
    return preferences;
  }

  function syncPreferences(nextPreferences) {
    if (disposed) return preferences;
    const next = sanitizeChartPreferences(nextPreferences);
    const intervalChanged = next.interval !== preferences.interval;
    preferences = next;
    emit();
    if (intervalChanged) reload().catch((error) => onWarning('BTC Live chart interval sync failed', error));
    return preferences;
  }

  function ingestMarketState(marketState) {
    if (disposed || !marketState || !Number.isFinite(marketState.currentPrice) || marketState.currentPrice <= 0) return;
    const eventAt = Number.isFinite(marketState.lastPriceEventAt) ? marketState.lastPriceEventAt : null;
    if (eventAt === null) return;
    const priceKey = Number.isSafeInteger(marketState.lastPriceTradeId)
      ? `trade:${marketState.lastPriceTradeId}`
      : `${marketState.priceSource ?? 'price'}:${eventAt}:${marketState.currentPrice}`;
    if (priceKey === lastLivePriceKey) return;
    lastLivePriceKey = priceKey;

    const duration = intervalMs(preferences.interval);
    const openTime = Math.floor(eventAt / duration) * duration;
    const closeTime = openTime + duration - 1;
    const price = marketState.currentPrice;
    const last = candles.at(-1);

    if (!last || openTime > last.openTime) {
      candles = [...candles, {
        openTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        closeTime
      }].slice(-limit);
      status = CHART_STATUS.READY;
      errorMessage = null;
      emit();
      return;
    }

    if (openTime !== last.openTime) return;
    const updated = {
      ...last,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
      closeTime: Math.max(last.closeTime, closeTime)
    };
    candles = [...candles.slice(0, -1), updated];
    status = CHART_STATUS.READY;
    emit();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    requestGeneration += 1;
    requestController?.abort();
    requestController = null;
    if (refreshTimer !== null) clearIntervalFn(refreshTimer);
    refreshTimer = null;
  }

  return {
    start,
    reload,
    updatePreferences,
    syncPreferences,
    ingestMarketState,
    snapshot,
    dispose
  };
}
