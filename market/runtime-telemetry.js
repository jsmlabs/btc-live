/** Bounded, session-local runtime telemetry. No payloads or credentials are recorded. */
export const TELEMETRY_EVENT = Object.freeze({
  SOCKET_CONNECT: 'SOCKET_CONNECT', SOCKET_OPEN: 'SOCKET_OPEN', SOCKET_CLOSE: 'SOCKET_CLOSE',
  SOCKET_ERROR: 'SOCKET_ERROR', RECONNECT_SCHEDULED: 'RECONNECT_SCHEDULED',
  SNAPSHOT_SUCCESS: 'SNAPSHOT_SUCCESS', SNAPSHOT_FAILURE: 'SNAPSHOT_FAILURE',
  STATUS_CHANGE: 'STATUS_CHANGE', SETTINGS_FAILURE: 'SETTINGS_FAILURE'
});
const EVENTS = new Set(Object.values(TELEMETRY_EVENT));
export function createRuntimeTelemetry({ now = () => Date.now(), capacity = 64 } = {}) {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1024) throw new RangeError('Invalid telemetry capacity');
  const counts = Object.fromEntries([...EVENTS].map(key => [key, 0]));
  const recent = [];
  let sequence = 0;
  function record(type, attributes = {}) {
    if (!EVENTS.has(type)) throw new RangeError('Unknown telemetry event');
    // Only known, non-sensitive numeric/string fields; never store arbitrary exception objects.
    const entry = { sequence: ++sequence, at: now(), type };
    if (typeof attributes.feed === 'string' && ['market', 'book'].includes(attributes.feed)) entry.feed = attributes.feed;
    if (typeof attributes.status === 'string' && /^[A-Z_]{1,24}$/.test(attributes.status)) entry.status = attributes.status;
    if (Number.isFinite(attributes.delayMs) && attributes.delayMs >= 0) entry.delayMs = attributes.delayMs;
    counts[type]++;
    recent.push(entry);
    if (recent.length > capacity) recent.shift();
  }
  function snapshot() { return { total: sequence, counts: { ...counts }, recent: recent.map(e => ({ ...e })) }; }
  return { record, snapshot };
}
