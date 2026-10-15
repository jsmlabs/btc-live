// Viewport state belongs to the visible chart, never to the exchange candle stream.
export function createChartViewport({ defaultVisible = 120, minVisible = 20, maxVisible = 240 } = {}) {
  let visible = defaultVisible, endOffset = 0;
  const clamp = (count) => {
    const windowCount = Math.min(Math.max(1,count), visible);
    endOffset = Math.min(endOffset, Math.max(0,count-windowCount));
    const end = Math.max(0, count-endOffset);
    return { start: Math.max(0,end-windowCount), end, visible:windowCount, following:endOffset===0 };
  };
  return {
    range(count) {return clamp(count);},
    zoom(direction, count) {
      visible = Math.max(minVisible, Math.min(maxVisible, Math.round(visible * (direction > 0 ? 0.8 : 1.25))));
      return clamp(count);
    },
    // Keep the candle below the pointer stationary during wheel zoom.
    // Fraction is relative to the plot region, not the complete SVG/price axis.
    zoomAt(direction, count, fraction = 0.5) {
      const before = clamp(count);
      const anchor = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0.5;
      const anchorIndex = before.start + anchor * Math.max(0, before.visible - 1);
      visible = Math.max(minVisible, Math.min(maxVisible, Math.round(visible * (direction > 0 ? 0.8 : 1.25))));
      const nextCount = Math.min(Math.max(1, count), visible);
      const maxStart = Math.max(0, count - nextCount);
      const start = Math.max(0, Math.min(maxStart, Math.round(anchorIndex - anchor * (nextCount - 1))));
      endOffset = Math.max(0, count - (start + nextCount));
      return clamp(count);
    },
    pan(delta, count) {endOffset = Math.max(0,endOffset+Math.round(delta));return clamp(count);},
    // Preserve the exact inspected candle when new candles arrive or the rolling history trims.
    preserveAnchor(previous, next) {
      if (endOffset === 0 || !Array.isArray(previous) || !Array.isArray(next) || !previous.length || !next.length) return clamp(next?.length ?? 0);
      const oldEnd = Math.max(0, previous.length - endOffset - 1);
      const anchorTime = previous[oldEnd]?.openTime;
      if (!Number.isSafeInteger(anchorTime)) return clamp(next.length);
      const matching = next.findIndex(c => c?.openTime === anchorTime);
      if (matching >= 0) endOffset = next.length - matching - 1;
      else if (anchorTime < next[0]?.openTime) endOffset = next.length;
      else if (anchorTime > next.at(-1)?.openTime) endOffset = 0;
      return clamp(next.length);
    },
    toLive(count) {endOffset=0;return clamp(count);},
    reset(count) {visible=defaultVisible;endOffset=0;return clamp(count);},
    snapshot(count) {return {...clamp(count), endOffset};}
  };
}
