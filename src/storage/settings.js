export const DEFAULT_SETTINGS = Object.freeze({
  showBidAsk: true,
  showVolume: true,
  priceAnimation: true
});

const STORAGE_KEY = 'btcLiveSettings';

function extensionApi() {
  return globalThis.browser ?? globalThis.chrome ?? null;
}

function sanitizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    showBidAsk: typeof source.showBidAsk === 'boolean' ? source.showBidAsk : DEFAULT_SETTINGS.showBidAsk,
    showVolume: typeof source.showVolume === 'boolean' ? source.showVolume : DEFAULT_SETTINGS.showVolume,
    priceAnimation: typeof source.priceAnimation === 'boolean' ? source.priceAnimation : DEFAULT_SETTINGS.priceAnimation
  };
}

export async function loadSettings() {
  const api = extensionApi();
  if (!api?.storage?.local) return { ...DEFAULT_SETTINGS };
  const result = await api.storage.local.get(STORAGE_KEY);
  return sanitizeSettings(result?.[STORAGE_KEY]);
}

export async function saveSettings(settings) {
  const sanitized = sanitizeSettings(settings);
  const api = extensionApi();
  if (!api?.storage?.local) return sanitized;
  await api.storage.local.set({ [STORAGE_KEY]: sanitized });
  return sanitized;
}
