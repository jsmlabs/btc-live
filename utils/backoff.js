export const RECONNECT_DELAYS_MS = Object.freeze([1000, 2000, 4000, 8000, 15000, 30000]);

export function reconnectDelay(attempt) {
  if (!Number.isInteger(attempt) || attempt < 0) throw new TypeError('attempt must be a non-negative integer');
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
}
