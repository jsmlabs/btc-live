export const ALERT_HISTORY_STORAGE_KEY = 'btcLiveAlertHistory';
export const MAX_ALERT_HISTORY = 100;

function extensionApi() {
  return globalThis.browser ?? globalThis.chrome ?? null;
}

function cleanText(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function sanitizeAlertHistoryEntry(value) {
  const source = value && typeof value === 'object' ? value : {};
  if (!Number.isFinite(source.at) || source.at < 0) return null;
  const status = ['sent', 'suppressed', 'failed'].includes(source.status) ? source.status : 'sent';
  const type = ['target', 'price_move', 'connection'].includes(source.type) ? source.type : null;
  if (!type) return null;
  return {
    id: cleanText(source.id, 100) || `event-${source.at}`,
    at: source.at,
    type,
    status,
    source: cleanText(source.source, 24) || 'unknown',
    title: cleanText(source.title, 100),
    message: cleanText(source.message, 240),
    currentPrice: Number.isFinite(source.currentPrice) && source.currentPrice > 0 ? source.currentPrice : null,
    targetId: cleanText(source.targetId, 100) || null,
    targetPrice: Number.isFinite(source.targetPrice) && source.targetPrice > 0 ? source.targetPrice : null,
    direction: source.direction === 'above' || source.direction === 'below' || source.direction === 'up' || source.direction === 'down' ? source.direction : null,
    reason: cleanText(source.reason, 80) || null
  };
}

export function sanitizeAlertHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.map(sanitizeAlertHistoryEntry).filter(Boolean).slice(0, MAX_ALERT_HISTORY);
}

export async function loadAlertHistory() {
  const api = extensionApi();
  if (!api?.storage?.local) return [];
  const result = await api.storage.local.get(ALERT_HISTORY_STORAGE_KEY);
  return sanitizeAlertHistory(result?.[ALERT_HISTORY_STORAGE_KEY]);
}

export async function appendAlertHistory(entry) {
  const sanitized = sanitizeAlertHistoryEntry(entry);
  if (!sanitized) return null;
  return withHistoryLock(async () => {
    const history = await loadAlertHistory();
    const next = [sanitized, ...history].slice(0, MAX_ALERT_HISTORY);
    const api = extensionApi();
    if (api?.storage?.local) await api.storage.local.set({ [ALERT_HISTORY_STORAGE_KEY]: next });
    return sanitized;
  });
}

export async function clearAlertHistory() {
  const api = extensionApi();
  if (!api?.storage?.local) return;
  await api.storage.local.set({ [ALERT_HISTORY_STORAGE_KEY]: [] });
}

async function withHistoryLock(task) {
  const locks = globalThis.navigator?.locks;
  if (locks?.request) return locks.request('btc-live-alert-history', task);
  return task();
}
