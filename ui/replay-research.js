/** Bounded, offline-only replay research helpers. Never mutate live market state. */
export const MAX_BOOKMARKS = 64;
export function clampReplayPosition(length, position) {
  if (!Number.isSafeInteger(length) || length < 0 || !Number.isFinite(position)) throw new RangeError('Invalid replay position');
  return length ? Math.max(0, Math.min(length - 1, Math.trunc(position))) : 0;
}
export function seekReplayByTimestamp(frames, at) {
  if (!Array.isArray(frames) || !Number.isFinite(at)) throw new TypeError('Invalid replay seek');
  if (!frames.length) return 0;
  let low = 0, high = frames.length;
  while (low < high) { const mid = (low + high) >>> 1; if (frames[mid].at < at) low = mid + 1; else high = mid; }
  if (low === 0) return 0;
  if (low === frames.length) return low - 1;
  return Math.abs(frames[low].at - at) < Math.abs(frames[low - 1].at - at) ? low : low - 1;
}
export function addReplayBookmark(bookmarks, frames, position, note = '') {
  if (!Array.isArray(bookmarks) || !Array.isArray(frames) || !frames.length) throw new Error('No replay data');
  if (typeof note !== 'string' || note.length > 160 || /[\u0000-\u001f\u007f]/.test(note)) throw new Error('Invalid bookmark note');
  const index = clampReplayPosition(frames.length, position);
  if (bookmarks.length >= MAX_BOOKMARKS && !bookmarks.some(b => b.index === index)) throw new Error('Bookmark limit reached');
  const next = bookmarks.filter(b => b.index !== index);
  return [...next, { index, at: frames[index].at, note }].sort((a,b) => a.index - b.index);
}
export function compareReplaySessions(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || !first.length || !second.length) throw new Error('Two non-empty sessions required');
  const summarize = frames => {
    const prices = frames.filter(f => Number.isFinite(f.price) && f.price > 0);
    const depthCount = frames.filter(f => f.depthReady === true).length;
    const flowCount = frames.filter(f => Number.isFinite(f.cvdBtc)).length;
    return { events: frames.length, startAt: frames[0].at, endAt: frames.at(-1).at,
      durationMs: frames.at(-1).at - frames[0].at, depthCount, flowCount,
      startPrice: prices.length ? prices[0].price : null, endPrice: prices.length ? prices.at(-1).price : null,
      priceChange: prices.length >= 2 ? prices.at(-1).price - prices[0].price : null };
  };
  return { a: summarize(first), b: summarize(second), note: 'Descriptive receipt-order observations; differing gaps and capture lengths affect comparability.' };
}
