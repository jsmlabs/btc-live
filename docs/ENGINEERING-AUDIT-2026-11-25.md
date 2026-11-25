# BTC Live — engineering audit (pass 1)

- Date: 2026-11-25
- Baseline: `bf5c454fdc582074fcf33a5f15b130a8cdc989e5` (main, version 1.25.8)
- Scope: targeted source review of market ingestion, chart lifecycle, flow aggregation, depth, capture/replay, manifest and verification configuration. Not a comprehensive security audit, live exchange test or release acceptance.
- Existing orderbook PR #62 is independent and not included in this branch.

## Findings

| ID | Priority | Location | Finding | Acceptance criterion |
| --- | --- | --- | --- | --- |
| AUD-01 | High | ui/order-flow.js:55–77 | At a non-aligned snapshot timestamp (e.g. 310500), multiwindow metrics compare slot timestamps with an unrounded cutoff while the legacy chart uses rounded slots. The 60s totals disagree and the 300s window loses its earliest retained bucket; alerts consume these metrics. | Same bucket inclusion for legacy and configured windows at aligned and unaligned timestamps; preserve signed quantities and counts. |
| AUD-02 | Medium | app/chart-runtime.js: changeInterval, updatePreferences, syncPreferences | Both preference paths emit the new interval alongside old candles before clearing them; subscribers may briefly consume mislabeled OHLCV. | No snapshot associates old-interval candles with new interval, including storage synchronization. |
| AUD-03 | Medium | market/binance-klines.js: intervalMs, normalizeKlineRow | Inherited object keys (constructor/toString) are accepted by interval lookup. Number coercion accepts null/boolean/empty strings as valid numeric data (e.g. null volume becomes 0). | Reject non-allowlisted intervals and invalid field types; valid numeric/string exchange data remains accepted. |
| AUD-04 | Medium | ui/event-recorder.js: levels, cleanEvent | Live depth applies repeated price updates in order (including delete then add, explicitly tested in feed-recovery); event capture rejects the same sequence as duplicate depth levels, invalidating an otherwise valid recording. | Allow ordered repeats in diffs only; keep snapshot uniqueness, bounds and sequence checks. |
| AUD-05 | Medium | ui/event-replay.js: evaluateEventConfluence | Continuity guard tests the initial/current depth anchor but not each intervening frame; an intervening different anchor can be compared as continuous with malformed or nonstandard frame input. | Require the same depthFrom on every frame used in the comparison. |

## Follow-up investigation (not verified defects)

- Depth and execution receipt freshness versus exchange-event freshness under delayed or bursty network delivery; validate with captured fixtures and clocks.
- Chart reconnect, REST/WS reconciliation, hidden/offline transitions, history pagination, and rapid interval changes with deferred promises.
- Alert deduplication/cooldown on feed gaps, MV3 worker suspension and cross-context storage races.
- Replay import size/CPU budgets, IndexedDB transaction failures, repeated imports and long recordings.
- UI: keyboard navigation, responsive overflow, heatmap/ladder consistency, live/stale transitions, render churn.
- Security: inspect all external fetches, DOM injection sinks, release/updater trust boundary and permission scope; manifest inspection alone does not prove security.
- Performance: profile real extension under sustained depth/aggTrade load, measure CPU/heap/long tasks rather than asserting a gain.

## Verification plan

1. Add focused regression tests for confirmed findings before integration.
2. Run `npm test`, `npm run verify`, `npm run test:ui` and existing installed-MV3 CI jobs on exact candidate SHA.
3. Manually exercise live Binance, reconnection, offline/online, hidden tab, worker suspension and replay on installed extension. Keep synthetic evidence distinct from live evidence.
4. Keep PR #62 independent; merge only after applicable checks and review. No production release or version bump in this audit pass.

Local clone attempt failed because the execution environment could not resolve github.com. Source was inspected through the authenticated repository connector. No claim of complete repository coverage or full test execution.
