import { DEFAULT_KLINE_INTERVAL, KLINE_INTERVALS } from '../market/binance-klines.js';

export const CHART_PREFERENCES_STORAGE_KEY = 'btcLiveChartPreferences';
export const CHART_MODES = Object.freeze(['candles', 'line', 'area']);
export const DEFAULT_CHART_PREFERENCES = Object.freeze({
  interval: DEFAULT_KLINE_INTERVAL,
  mode: 'candles',
  candleStyle: 'classic',
  highlightActiveCandle: true,
  showPatterns: false,
  showVolumeIntelligence: false,
  showVolume: true,
  ema20: false,
  ema50: false,
  sma200: false,
  show24h: true,
  showAlerts: true,
  showLiquidity: false,
  showTrades: false,
  followLive: true
});

function extensionApi() {
  return globalThis.browser ?? globalThis.chrome ?? null;
}

export function sanitizeChartPreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    interval: KLINE_INTERVALS.includes(source.interval) ? source.interval : DEFAULT_CHART_PREFERENCES.interval,
    mode: CHART_MODES.includes(source.mode) ? source.mode : DEFAULT_CHART_PREFERENCES.mode,
    candleStyle: ['classic','outline','minimal'].includes(source.candleStyle) ? source.candleStyle : 'classic',
    highlightActiveCandle: source.highlightActiveCandle !== false,
    showPatterns: source.showPatterns === true,
    showVolumeIntelligence: source.showVolumeIntelligence === true,
    showVolume: typeof source.showVolume === 'boolean' ? source.showVolume : DEFAULT_CHART_PREFERENCES.showVolume,
    ema20: source.ema20 === true,
    ema50: source.ema50 === true,
    sma200: source.sma200 === true,
    show24h: source.show24h !== false,
    showAlerts: source.showAlerts !== false,
    showLiquidity: source.showLiquidity === true,
    showTrades: source.showTrades === true,
    followLive: source.followLive !== false
  };
}

export async function loadChartPreferences() {
  const api = extensionApi();
  if (!api?.storage?.local) return { ...DEFAULT_CHART_PREFERENCES };
  const result = await api.storage.local.get(CHART_PREFERENCES_STORAGE_KEY);
  return sanitizeChartPreferences(result?.[CHART_PREFERENCES_STORAGE_KEY]);
}

export async function saveChartPreferences(preferences) {
  const sanitized = sanitizeChartPreferences(preferences);
  const api = extensionApi();
  if (!api?.storage?.local) return sanitized;
  await api.storage.local.set({ [CHART_PREFERENCES_STORAGE_KEY]: sanitized });
  return sanitized;
}

// Serialize local chart preference writes so slower earlier operations cannot
// overwrite a newer user selection. A failed write must not poison the queue.
export function createSerialChartPreferencesWriter(write = saveChartPreferences) {
  if (typeof write !== 'function') throw new TypeError('write must be a function');
  let tail = Promise.resolve();
  return function persist(value) {
    const preferences = sanitizeChartPreferences(value);
    const operation = tail.then(() => write(preferences));
    tail = operation.catch(() => undefined);
    return operation;
  };
}
