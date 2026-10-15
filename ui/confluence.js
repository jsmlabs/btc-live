/** Descriptive, deterministic combination of observed market conditions; never a trade signal. */
export function evaluateConfluence(frames, index) {
  const base = { status: 'UNAVAILABLE', label: 'Not enough synchronized observations', details: 'Requires two consecutive valid samples with continuous trade feed.', reasons: ['INSUFFICIENT_OR_INVALID_SAMPLES'], deltaBtc: null, priceChange: null };
  if (!Array.isArray(frames) || !Number.isInteger(index) || index <= 0 || index >= frames.length) return base;
  const older = frames[index - 1], current = frames[index];
  if (!older || !current || current.at - older.at !== 2_000 || current.bucketSize !== older.bucketSize ||
      older.flowStatus !== 'LIVE' || current.flowStatus !== 'LIVE' || older.depthStatus !== 'LIVE' || current.depthStatus !== 'LIVE' ||
      older.priceStatus !== 'LIVE' || current.priceStatus !== 'LIVE' || !older.flow || !current.flow ||
      !older.bands?.length || !current.bands?.length || older.flow.segment !== current.flow.segment ||
      older.price === null || current.price === null) return base;
  const deltaBtc = current.flow.cvdBtc - older.flow.cvdBtc;
  const priceChange = current.price - older.price;
  if (!Number.isFinite(deltaBtc) || !Number.isFinite(priceChange)) return base;
  const oldBands = new Map(older.bands.map((b) => [`${b.side}:${b.lower}`, b.notional]));
  const currentBands = new Map(current.bands.map((b) => [`${b.side}:${b.lower}`, b.notional]));
  let bids = 0, asks = 0;
  for (const key of new Set([...oldBands.keys(), ...currentBands.keys()])) {
    const change = (currentBands.get(key) ?? 0) - (oldBands.get(key) ?? 0);
    if (key.startsWith('bid:')) bids += change; else asks += change;
  }
  const direction = Math.sign(deltaBtc) === Math.sign(priceChange) && deltaBtc !== 0 && priceChange !== 0;
  const label = direction ? (deltaBtc > 0 ? 'Buying and price rising' : 'Selling and price falling') : 'Mixed execution / price response';
  return {
    status: 'OBSERVED', label, reasons: [], inputs: { olderAt: older.at, currentAt: current.at, segment: current.flow.segment, bucketSize: current.bucketSize }, deltaBtc, priceChange, bidNotionalChange: bids, askNotionalChange: asks,
    details: '2s sampled observations across independent, non-atomic feeds. Book changes are net visible notional, not order additions/cancellations; no confirmed absorption or predictive signal.'
  };
}

/** Descriptive price/flow swing disagreement. Never a predictive signal. */
export function evaluatePriceDeltaDivergence(frames, index, lookback = 3) {
  const missing = (reason) => ({ status: 'UNAVAILABLE', direction: null, reason });
  if (!Array.isArray(frames) || !Number.isInteger(index) || !Number.isInteger(lookback) ||
      lookback < 2 || lookback > 60 || index < lookback || index >= frames.length) return missing('INSUFFICIENT_HISTORY');
  const slice = frames.slice(index - lookback, index + 1);
  const segment = slice[0]?.flow?.segment;
  for (let i = 0; i < slice.length; i++) {
    const v = slice[i];
    if (!v || !Number.isSafeInteger(v.at) || !Number.isFinite(v.price) ||
        !Number.isFinite(v.flow?.cvdBtc) || v.flowStatus !== 'LIVE' || v.priceStatus !== 'LIVE' ||
        v.flow.segment !== segment || (i && (v.at - slice[i - 1].at !== 2_000))) return missing('INVALID_OR_DISCONTINUOUS_FEED');
  }
  const previous = slice.slice(0, -1);
  const current = slice.at(-1);
  const previousHigh = Math.max(...previous.map(v => v.price));
  const previousLow = Math.min(...previous.map(v => v.price));
  const previousCvdHigh = Math.max(...previous.map(v => v.flow.cvdBtc));
  const previousCvdLow = Math.min(...previous.map(v => v.flow.cvdBtc));
  const direction = current.price > previousHigh && current.flow.cvdBtc < previousCvdHigh ? 'BEARISH_DIVERGENCE' :
    current.price < previousLow && current.flow.cvdBtc > previousCvdLow ? 'BULLISH_DIVERGENCE' : 'NONE';
  return { status: 'OBSERVED', direction, reason: 'DESCRIPTIVE_ONLY',
    inputs: { fromAt: slice[0].at, toAt: current.at, segment, lookback,
      previousHigh, previousLow, previousCvdHigh, previousCvdLow, currentPrice: current.price, currentCvdBtc: current.flow.cvdBtc } };
}
