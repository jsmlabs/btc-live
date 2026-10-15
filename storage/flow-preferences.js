export const FLOW_PREFERENCES_KEY = 'btcLiveFlowPreferences';
export const DEFAULT_FLOW_PREFERENCES = Object.freeze({ enabled: true });
export function sanitizeFlowPreferences(input) {
  return { enabled: typeof input?.enabled === 'boolean' ? input.enabled : DEFAULT_FLOW_PREFERENCES.enabled };
}
const storage = () => (globalThis.browser ?? globalThis.chrome)?.storage?.local;
export async function loadFlowPreferences() {
  const store = storage();
  if (!store) return { ...DEFAULT_FLOW_PREFERENCES };
  const result = await store.get(FLOW_PREFERENCES_KEY);
  return sanitizeFlowPreferences(result?.[FLOW_PREFERENCES_KEY]);
}
export async function saveFlowPreferences(value) {
  const store = storage();
  if (!store) return;
  await store.set({ [FLOW_PREFERENCES_KEY]: sanitizeFlowPreferences(value) });
}
