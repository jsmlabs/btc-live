# BTC Live v1.21.0 - Render performance measurement

## Reproduction

From the repository root, using Node.js 22 or newer:

```bash
node scripts/benchmark-render.mjs --baseline
node scripts/benchmark-render.mjs --optimized
npm run verify
```

The synthetic work model consists of 120 live market state updates, two visual notifications per update (as in the previous dashboard wiring), four updates before each animation-frame flush, 40 subsequent refreshes with unchanged chart geometry, and 120 deterministic OHLCV candles. A minimal DOM substitute tracks SVG replacements and newly created SVG nodes. Baseline mode deliberately forces the former unconditional chart rebuild; optimized mode exercises the coalescing scheduler and the chart geometry cache.

| Deterministic measure | Original v1.20.0 baseline | Optimized v1.21.0 | Change |
| --- | ---: | ---: | ---: |
| Chart renderer calls | 281 | 71 | -74.7% |
| SVG subtree rebuilds | 281 | 31 | -89.0% |
| Created SVG nodes | 107,342 | 11,842 | -89.0% |

The **original baseline** was measured against the uploaded v1.20.0 code before edits; replaying baseline mode on v1.21.0 reproduces the same deterministic SVG-work counts. Runtime wall-clock time is machine-, JIT- and environment-dependent and is intentionally omitted from performance claims. Counts reflect this single artificial event grouping, not an overall performance guarantee.

## Implementation boundaries

- `ui/render-scheduler.js` merges only dashboard visual requests using the latest available snapshot. It does not delay `notificationManager.observe()` or `chartRuntime.ingestMarketState()`.
- A pending animation frame is flushed on foreground `visibilitychange`, since inactive Chromium tabs may suspend frames.
- Unmount/dispose cancels pending work and rejects subsequent schedule requests.
- `ui/chart.js` reuses SVG geometry only when candle geometry, chart mode/interval/volume preference and referenced live/24h prices are identical. Textual status and level labels still update.
- Chart SVG caching is scoped to the SVG DOM element through a WeakMap; reopening the dashboard gets a fresh cache.

## Remaining verification

- Real Chromium CPU time, frame latency, memory usage and background-tab scheduling have **not** been benchmarked.
- Run Chrome DevTools Performance against a real Futures feed on representative hardware; verify alerts remain synchronous under burst traffic, and test page visibility transitions.
- Synthetic DOM work reduction is not an end-to-end latency or power-consumption result.
