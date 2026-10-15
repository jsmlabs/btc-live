// Pure, warm-up aware calculations. Undefined samples are represented as null.
export function sma(candles, period) {
  if (!Number.isSafeInteger(period) || period < 2) throw new RangeError('Invalid SMA period');
  let total = 0;
  return candles.map((c, i) => {
    if (!Number.isFinite(c.close)) throw new TypeError('Invalid candle close');
    total += c.close;
    if (i >= period) total -= candles[i-period].close;
    return i < period-1 ? null : total/period;
  });
}
export function ema(candles, period) {
  if (!Number.isSafeInteger(period) || period < 2) throw new RangeError('Invalid EMA period');
  let seed = 0, previous = null;
  return candles.map((c,i) => {
    if (!Number.isFinite(c.close)) throw new TypeError('Invalid candle close');
    if (i < period) seed += c.close;
    if (i < period-1) return null;
    if (i === period-1) previous = seed/period;
    else previous = c.close*(2/(period+1)) + previous*(1-2/(period+1));
    return previous;
  });
}
