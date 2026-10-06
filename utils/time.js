export function formatRelativeTime(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Never';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 1) return '<1s ago';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function isPlausibleTimestamp(value, now = Date.now()) {
  if (!Number.isFinite(value)) return false;
  const maxFutureSkewMs = 60_000;
  const maxPastAgeMs = 48 * 60 * 60 * 1000;
  return value > now - maxPastAgeMs && value <= now + maxFutureSkewMs;
}

export function isRecentTimestamp(value, now = Date.now(), maxAgeMs = 30_000) {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new TypeError('maxAgeMs must be a non-negative finite number');
  if (!isPlausibleTimestamp(value, now)) return false;
  return value >= now - maxAgeMs;
}
