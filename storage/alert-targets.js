import { loadSettings } from './settings.js';

export const ALERT_TARGETS_STORAGE_KEY = 'btcLiveAlertTargets';
export const MAX_ALERT_TARGETS = 50;

function extensionApi() {
  return globalThis.browser ?? globalThis.chrome ?? null;
}

function sanitizePrice(value) {
  return Number.isFinite(value) && value >= 100 && value <= 10_000_000
    ? Math.round(value * 100) / 100
    : null;
}

function sanitizeLabel(value) {
  return typeof value === 'string' ? value.trim().slice(0, 48) : '';
}

function sanitizeId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : null;
}

function makeId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `target-${uuid}`;
  return `target-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeAlertTarget(value, { now = Date.now } = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const price = sanitizePrice(source.price);
  const direction = source.direction === 'above' || source.direction === 'below' ? source.direction : null;
  if (price === null || direction === null) return null;
  const createdAt = Number.isFinite(source.createdAt) && source.createdAt >= 0 ? source.createdAt : now();
  const updatedAt = Number.isFinite(source.updatedAt) && source.updatedAt >= 0 ? source.updatedAt : createdAt;
  const triggeredAt = Number.isFinite(source.triggeredAt) && source.triggeredAt >= 0 ? source.triggeredAt : null;
  return {
    id: sanitizeId(source.id) ?? makeId(),
    direction,
    price,
    label: sanitizeLabel(source.label),
    enabled: source.enabled !== false,
    triggered: source.triggered === true,
    triggeredAt,
    createdAt,
    updatedAt
  };
}

export function sanitizeAlertTargets(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const candidate of value) {
    const target = sanitizeAlertTarget(candidate);
    if (!target || seen.has(target.id)) continue;
    seen.add(target.id);
    result.push(target);
    if (result.length >= MAX_ALERT_TARGETS) break;
  }
  return result;
}

export function legacyTargetsFromSettings(settings, { now = Date.now } = {}) {
  const targets = [];
  if (settings?.notifyPriceAbove && Number.isFinite(settings.priceAboveTarget)) {
    targets.push(sanitizeAlertTarget({
      id: 'legacy-above', direction: 'above', price: settings.priceAboveTarget,
      label: 'Migrated above target', enabled: true, createdAt: now(), updatedAt: now()
    }, { now }));
  }
  if (settings?.notifyPriceBelow && Number.isFinite(settings.priceBelowTarget)) {
    targets.push(sanitizeAlertTarget({
      id: 'legacy-below', direction: 'below', price: settings.priceBelowTarget,
      label: 'Migrated below target', enabled: true, createdAt: now(), updatedAt: now()
    }, { now }));
  }
  return targets.filter(Boolean);
}

export async function loadAlertTargets({ migrateLegacy = true } = {}) {
  const api = extensionApi();
  if (!api?.storage?.local) return [];
  const result = await api.storage.local.get(ALERT_TARGETS_STORAGE_KEY);
  if (Object.prototype.hasOwnProperty.call(result ?? {}, ALERT_TARGETS_STORAGE_KEY)) {
    return sanitizeAlertTargets(result[ALERT_TARGETS_STORAGE_KEY]);
  }
  if (!migrateLegacy) return [];
  const migrated = legacyTargetsFromSettings(await loadSettings());
  await api.storage.local.set({ [ALERT_TARGETS_STORAGE_KEY]: migrated });
  return migrated;
}

export async function saveAlertTargets(targets) {
  const sanitized = sanitizeAlertTargets(targets);
  const api = extensionApi();
  if (!api?.storage?.local) return sanitized;
  await api.storage.local.set({ [ALERT_TARGETS_STORAGE_KEY]: sanitized });
  return sanitized;
}

export async function addAlertTarget({ direction, price, label = '', enabled = true } = {}) {
  return withAlertTargetLock(async () => {
    const targets = await loadAlertTargets();
    if (targets.length >= MAX_ALERT_TARGETS) throw new RangeError(`A maximum of ${MAX_ALERT_TARGETS} price targets is supported.`);
    const target = sanitizeAlertTarget({ direction, price, label, enabled });
    if (!target) throw new TypeError('A valid direction and BTC price are required.');
    return { target, targets: await saveAlertTargets([...targets, target]) };
  });
}

export async function updateAlertTarget(id, patch) {
  return withAlertTargetLock(async () => {
    const targets = await loadAlertTargets();
    let updated = null;
    const next = targets.map((target) => {
      if (target.id !== id) return target;
      updated = sanitizeAlertTarget({ ...target, ...patch, id: target.id, updatedAt: Date.now() });
      return updated ?? target;
    });
    if (!updated) throw new Error('Price target not found.');
    await saveAlertTargets(next);
    return updated;
  });
}

export async function removeAlertTarget(id) {
  return withAlertTargetLock(async () => {
    const targets = await loadAlertTargets();
    const next = targets.filter((target) => target.id !== id);
    if (next.length === targets.length) return false;
    await saveAlertTargets(next);
    return true;
  });
}

async function withAlertTargetLock(task) {
  const locks = globalThis.navigator?.locks;
  if (locks?.request) return locks.request('btc-live-alert-targets', task);
  return task();
}
