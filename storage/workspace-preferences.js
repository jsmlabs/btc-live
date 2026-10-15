// Dashboard-only presentation state; intentionally separate from market and alert settings.
export const WORKSPACE_STORAGE_KEY = 'btcLiveWorkspaceV1';
export const WORKSPACE_VIEWS = Object.freeze(['live', 'analytics', 'replay', 'alerts', 'diagnostics', 'settings']);
export const WORKSPACE_PRESETS = Object.freeze(['simple', 'advanced', 'custom']);
export const SIMPLE_VIEWS = Object.freeze(['live', 'alerts', 'diagnostics', 'settings']);
export const DEFAULT_WORKSPACE = Object.freeze({ preset: 'advanced', landingView: 'live' });

export function sanitizeWorkspace(value) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    preset: WORKSPACE_PRESETS.includes(candidate.preset) ? candidate.preset : DEFAULT_WORKSPACE.preset,
    landingView: WORKSPACE_VIEWS.includes(candidate.landingView) ? candidate.landingView : DEFAULT_WORKSPACE.landingView
  };
}
export function allowedWorkspaceViews(preset) {
  return preset === 'simple' ? SIMPLE_VIEWS : WORKSPACE_VIEWS;
}
export function initialWorkspaceView(value) {
  const settings = sanitizeWorkspace(value);
  const requested = settings.preset === 'custom' ? settings.landingView : 'live';
  return allowedWorkspaceViews(settings.preset).includes(requested) ? requested : 'live';
}
function extensionStorage() {
  return (globalThis.browser ?? globalThis.chrome)?.storage?.local;
}
export async function loadWorkspace() {
  const storage = extensionStorage();
  if (!storage) return { ...DEFAULT_WORKSPACE };
  const result = await storage.get(WORKSPACE_STORAGE_KEY);
  return sanitizeWorkspace(result?.[WORKSPACE_STORAGE_KEY]);
}
export async function saveWorkspace(value) {
  const settings = sanitizeWorkspace(value);
  const storage = extensionStorage();
  if (storage) await storage.set({ [WORKSPACE_STORAGE_KEY]: settings });
  return settings;
}
