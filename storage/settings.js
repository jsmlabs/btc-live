export const DEFAULT_SETTINGS = Object.freeze({
  compactLayout: false,
  showBidAsk: true,
  showVolume: true,
  showRange: true,
  priceAnimation: true,
  notificationsEnabled: false,
  backgroundAlertsEnabled: true,
  notifyPriceMove: true,
  priceMovePercentThreshold: 0.5,
  notifyPriceAbove: false,
  priceAboveTarget: null,
  notifyPriceBelow: false,
  priceBelowTarget: null,
  notifyConnectionIssues: true,
  notificationCooldownSeconds: 300
});

export const SETTINGS_STORAGE_KEY = 'btcLiveSettings';

function extensionApi() {
  return globalThis.browser ?? globalThis.chrome ?? null;
}

function sanitizeOptionalPrice(value) {
  return Number.isFinite(value) && value >= 100 && value <= 10_000_000
    ? Math.round(value * 100) / 100
    : null;
}

export function sanitizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    compactLayout: typeof source.compactLayout === 'boolean' ? source.compactLayout : DEFAULT_SETTINGS.compactLayout,
    showBidAsk: typeof source.showBidAsk === 'boolean' ? source.showBidAsk : DEFAULT_SETTINGS.showBidAsk,
    showVolume: typeof source.showVolume === 'boolean' ? source.showVolume : DEFAULT_SETTINGS.showVolume,
    showRange: typeof source.showRange === 'boolean' ? source.showRange : DEFAULT_SETTINGS.showRange,
    priceAnimation: typeof source.priceAnimation === 'boolean' ? source.priceAnimation : DEFAULT_SETTINGS.priceAnimation,
    notificationsEnabled: typeof source.notificationsEnabled === 'boolean' ? source.notificationsEnabled : DEFAULT_SETTINGS.notificationsEnabled,
    backgroundAlertsEnabled: typeof source.backgroundAlertsEnabled === 'boolean' ? source.backgroundAlertsEnabled : DEFAULT_SETTINGS.backgroundAlertsEnabled,
    notifyPriceMove: typeof source.notifyPriceMove === 'boolean' ? source.notifyPriceMove : DEFAULT_SETTINGS.notifyPriceMove,
    priceMovePercentThreshold: Number.isFinite(source.priceMovePercentThreshold) && source.priceMovePercentThreshold >= 0.1 && source.priceMovePercentThreshold <= 10 ? Math.round(source.priceMovePercentThreshold * 100) / 100 : DEFAULT_SETTINGS.priceMovePercentThreshold,
    notifyPriceAbove: typeof source.notifyPriceAbove === 'boolean' ? source.notifyPriceAbove : DEFAULT_SETTINGS.notifyPriceAbove,
    priceAboveTarget: sanitizeOptionalPrice(source.priceAboveTarget),
    notifyPriceBelow: typeof source.notifyPriceBelow === 'boolean' ? source.notifyPriceBelow : DEFAULT_SETTINGS.notifyPriceBelow,
    priceBelowTarget: sanitizeOptionalPrice(source.priceBelowTarget),
    notifyConnectionIssues: typeof source.notifyConnectionIssues === 'boolean' ? source.notifyConnectionIssues : DEFAULT_SETTINGS.notifyConnectionIssues,
    notificationCooldownSeconds: Number.isInteger(source.notificationCooldownSeconds) && source.notificationCooldownSeconds >= 15 && source.notificationCooldownSeconds <= 3600 ? source.notificationCooldownSeconds : DEFAULT_SETTINGS.notificationCooldownSeconds
  };
}

export async function loadSettings() {
  const api = extensionApi();
  if (!api?.storage?.local) return { ...DEFAULT_SETTINGS };
  const result = await api.storage.local.get(SETTINGS_STORAGE_KEY);
  return sanitizeSettings(result?.[SETTINGS_STORAGE_KEY]);
}

export async function saveSettings(settings) {
  const sanitized = sanitizeSettings(settings);
  const api = extensionApi();
  if (!api?.storage?.local) return sanitized;
  await api.storage.local.set({ [SETTINGS_STORAGE_KEY]: sanitized });
  return sanitized;
}

export async function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}

export function createSerialSettingsWriter(write = saveSettings) {
  if (typeof write !== 'function') throw new TypeError('write must be a function');
  let tail = Promise.resolve();

  return function persist(settings) {
    const sanitized = sanitizeSettings(settings);
    const operation = tail.then(() => write(sanitized));
    tail = operation.catch(() => undefined);
    return operation;
  };
}
