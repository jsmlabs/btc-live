import { DEFAULT_KLINE_INTERVAL, KLINE_INTERVALS } from '../market/binance-klines.js';

export const CHART_PREFERENCES_STORAGE_KEY = 'btcLiveChartPreferences';
export const CHART_MODES = Object.freeze(['candles', 'line']);
export const DEFAULT_CHART_PREFERENCES = Object.freeze({
  interval: DEFAULT_KLINE_INTERVAL,
  mode: 'candles',
  showVolume: true
});

function extensionApi() {
  return globalThis.browser ?? globalThis.chrome ?? null;
}

export function sanitizeChartPreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    interval: KLINE_INTERVALS.includes(source.interval) ? source.interval : DEFAULT_CHART_PREFERENCES.interval,
    mode: CHART_MODES.includes(source.mode) ? source.mode : DEFAULT_CHART_PREFERENCES.mode,
    showVolume: typeof source.showVolume === 'boolean' ? source.showVolume : DEFAULT_CHART_PREFERENCES.showVolume
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
