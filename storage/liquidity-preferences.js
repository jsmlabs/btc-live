export const LIQUIDITY_PREFERENCES_KEY = 'btcLiveLiquidityPreferences';
export const LIQUIDITY_BUCKET_SIZES = Object.freeze([25, 50, 100, 250]);
export const DEFAULT_LIQUIDITY_PREFERENCES = Object.freeze({ enabled: true, bucketSize: 50, mode: 'bars' });

export function sanitizeLiquidityPreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_LIQUIDITY_PREFERENCES.enabled,
    bucketSize: LIQUIDITY_BUCKET_SIZES.includes(source.bucketSize) ? source.bucketSize : DEFAULT_LIQUIDITY_PREFERENCES.bucketSize,
    mode: ['bars', 'heatmap'].includes(source.mode) ? source.mode : DEFAULT_LIQUIDITY_PREFERENCES.mode
  };
}

function storage() { return (globalThis.browser ?? globalThis.chrome)?.storage?.local; }

export async function loadLiquidityPreferences() {
  const api = storage();
  if (!api) return { ...DEFAULT_LIQUIDITY_PREFERENCES };
  const value = await api.get(LIQUIDITY_PREFERENCES_KEY);
  return sanitizeLiquidityPreferences(value?.[LIQUIDITY_PREFERENCES_KEY]);
}

export async function saveLiquidityPreferences(value) {
  const next = sanitizeLiquidityPreferences(value);
  await storage()?.set({ [LIQUIDITY_PREFERENCES_KEY]: next });
  return next;
}
