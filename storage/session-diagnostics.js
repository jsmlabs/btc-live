const STORAGE_KEY = 'btcLiveSessionDiagnostics';
const SCHEMA_VERSION = 1;
const MAX_REASON_LENGTH = 160;

function extensionApi() {
  return globalThis.browser ?? globalThis.chrome ?? null;
}

function sessionStorageArea() {
  return extensionApi()?.storage?.session ?? null;
}

export function createSessionDiagnostics(now = Date.now()) {
  const startedAt = finiteTimestamp(now) ?? Date.now();
  return {
    version: SCHEMA_VERSION,
    startedAt,
    reconnectCount: 0,
    lastConnectedAt: null,
    lastDisconnectAt: null,
    lastDisconnectReason: null
  };
}

export function sanitizeSessionDiagnostics(value, now = Date.now()) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: SCHEMA_VERSION,
    startedAt: finiteTimestamp(source.startedAt) ?? finiteTimestamp(now) ?? Date.now(),
    reconnectCount: Number.isSafeInteger(source.reconnectCount) && source.reconnectCount >= 0
      ? source.reconnectCount
      : 0,
    lastConnectedAt: finiteTimestamp(source.lastConnectedAt),
    lastDisconnectAt: finiteTimestamp(source.lastDisconnectAt),
    lastDisconnectReason: normalizeReason(source.lastDisconnectReason)
  };
}

export function recordConnected(diagnostics, now = Date.now()) {
  return {
    ...sanitizeSessionDiagnostics(diagnostics, now),
    lastConnectedAt: finiteTimestamp(now)
  };
}

export function recordDisconnect(diagnostics, reason, now = Date.now()) {
  const current = sanitizeSessionDiagnostics(diagnostics, now);
  return {
    ...current,
    lastDisconnectAt: finiteTimestamp(now),
    lastDisconnectReason: normalizeReason(reason) ?? 'Connection interrupted.'
  };
}

export function recordReconnect(diagnostics, reason, now = Date.now()) {
  const disconnected = recordDisconnect(diagnostics, reason, now);
  return {
    ...disconnected,
    reconnectCount: disconnected.reconnectCount + 1
  };
}

export async function loadSessionDiagnostics(now = Date.now()) {
  const area = sessionStorageArea();
  if (!area) return createSessionDiagnostics(now);
  const result = await area.get(STORAGE_KEY);
  return sanitizeSessionDiagnostics(result?.[STORAGE_KEY], now);
}

export async function saveSessionDiagnostics(diagnostics) {
  const sanitized = sanitizeSessionDiagnostics(diagnostics);
  const area = sessionStorageArea();
  if (!area) return sanitized;
  await area.set({ [STORAGE_KEY]: sanitized });
  return sanitized;
}

export async function resetSessionDiagnostics(now = Date.now()) {
  const fresh = createSessionDiagnostics(now);
  const area = sessionStorageArea();
  if (!area) return fresh;
  await area.set({ [STORAGE_KEY]: fresh });
  return fresh;
}

export function createSerialDiagnosticsWriter(write = saveSessionDiagnostics) {
  if (typeof write !== 'function') throw new TypeError('write must be a function');
  let tail = Promise.resolve();
  return function persist(diagnostics) {
    const sanitized = sanitizeSessionDiagnostics(diagnostics);
    const operation = tail.then(() => write(sanitized));
    tail = operation.catch(() => undefined);
    return operation;
  };
}

function finiteTimestamp(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeReason(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return normalized.slice(0, MAX_REASON_LENGTH);
}
