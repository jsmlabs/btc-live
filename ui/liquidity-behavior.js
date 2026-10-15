/** Only differences between successive, valid depth observations; no order identity or spoofing attribution. */
export function evaluateLiquidityBehavior(history, now, maxAgeMs = 6_000) {
  const empty = { status: 'UNAVAILABLE', bidChange: null, askChange: null, zones: [], sampleAt: null, note: 'Requires consecutive verified depth observations' };
  const samples = history?.samples;
  if (!Array.isArray(samples) || !Number.isFinite(now) || !history.stepMs) return empty;
  if (!samples.at(-1)?.bands) return { ...empty, status: 'UNAVAILABLE' };
  const valid = samples.filter((v) => v?.bands && Array.isArray(v.bands));
  const current = valid.at(-1);
  if (!current || now - current.at >= maxAgeMs || current.at > now) return { ...empty, status: 'STALE' };
  const previous = valid.at(-2);
  if (!previous || current.at - previous.at !== history.stepMs) return { ...empty, status: 'INSUFFICIENT', sampleAt: current.at };
  const lastThree = valid.slice(-3);
  const contiguous = lastThree.length === 3 && lastThree.every((v, i) => i === 0 || v.at - lastThree[i - 1].at === history.stepMs);
  const old = new Map(previous.bands.map(({ side, lower, notional }) => [`${side}:${lower}`, notional]));
  const recent = new Map(current.bands.map(({ side, lower, notional }) => [`${side}:${lower}`, notional]));
  let bidChange = 0, askChange = 0;
  for (const key of new Set([...old.keys(), ...recent.keys()])) {
    const change = (recent.get(key) ?? 0) - (old.get(key) ?? 0);
    if (key.startsWith('bid:')) bidChange += change;
    else if (key.startsWith('ask:')) askChange += change;
  }
  const zones = [...current.bands].filter((band) => band.notional > 0).map((band) => {
    const key = `${band.side}:${band.lower}`;
    return {
      side: band.side, lower: band.lower, notional: band.notional,
      persistence: contiguous ? lastThree.filter((entry) => entry.bands.some((v) => `${v.side}:${v.lower}` === key && v.notional > 0)).length : 1
    };
  }).sort((a,b) => b.notional - a.notional).slice(0, 3);
  return {
    status: 'LIVE', bidChange, askChange, zones, sampleAt: current.at,
    note: 'Net displayed notional change between 2 observations, not placed/cancelled order volume. Persistence means level observed in consecutive samples.'
  };
}


/** Net visible orderbook notional: never interprets changes as executed volume or order identity. */
export function evaluateLiquidityPersistence(history, now, observations = 5) {
  const unavailable = (reason) => ({ status: 'UNAVAILABLE', reason, zones: [] });
  if (!Array.isArray(history?.samples) || !Number.isSafeInteger(history.stepMs) || history.stepMs <= 0 ||
      !Number.isFinite(now) || !Number.isInteger(observations) || observations < 2 || observations > 30) return unavailable('INVALID_INPUT');
  const samples = history.samples.slice(-observations);
  if (samples.length !== observations) return unavailable('INSUFFICIENT_HISTORY');
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!Number.isSafeInteger(s?.at) || !Array.isArray(s.bands) ||
        s.bands.some(b => !['bid','ask'].includes(b.side) || !Number.isFinite(b.lower) ||
          !Number.isFinite(b.notional) || b.notional < 0) ||
        (i && s.at - samples[i - 1].at !== history.stepMs)) return unavailable('INVALID_OR_DISCONTINUOUS_DEPTH');
  }
  const last = samples.at(-1);
  if (last.at > now || now - last.at >= Math.max(history.stepMs * 2, 6_000)) return unavailable('STALE');
  const levels = new Map();
  for (const [i, sample] of samples.entries()) {
    const seen = new Set();
    for (const band of sample.bands) {
      if (band.notional === 0) continue;
      const key = `${band.side}:${band.lower}`;
      if (seen.has(key)) return unavailable('DUPLICATE_LEVEL');
      seen.add(key);
      let level = levels.get(key);
      if (!level) { level = { side: band.side, lower: band.lower, observedSamples: 0, firstNotional: band.notional, lastNotional: 0, lastIndex: -1, consecutive: 0 }; levels.set(key, level); }
      level.observedSamples++;
      level.consecutive = level.lastIndex === i - 1 ? level.consecutive + 1 : 1;
      level.lastIndex = i;
      level.lastNotional = band.notional;
    }
  }
  return { status: 'OBSERVED', sampleAt: last.at, observations,
    zones: [...levels.values()].filter(z => z.lastIndex === observations - 1)
      .map(({lastIndex: _unused, ...z}) => ({...z, netNotionalChange: z.lastNotional - z.firstNotional}))
      .sort((a,b) => b.consecutive - a.consecutive || b.lastNotional - a.lastNotional).slice(0, 12),
    note: 'Displayed notional across discrete depth snapshots; no order identity, execution or spoofing attribution.' };
}
