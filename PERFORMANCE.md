# BTC Live performance and measurement

**Evidence boundary:** The results below are an **archived deterministic DOM-work benchmark** of the earlier v1.21.0 rendering improvements. They are **not measured real-Chromium CPU, memory, frame-rate, latency or energy improvements** for the integrated v16 candidate.

## Historical synthetic benchmark

The prior test reproduced a scenario with **120** market updates, grouped visual requests, **40** refreshes with identical chart geometry and **120** deterministic OHLCV candles. A minimal substitute DOM counted SVG work, not real-browser painting or throughput.

| Deterministic metric | v1.20 baseline | v1.21 optimized | Change |
| --- | ---: | ---: | ---: |
| Chart render calls | 281 | 71 | -74.7% |
| SVG subtree rebuilds | 281 | 31 | -89.0% |
| Created SVG nodes | 107,342 | 11,842 | -89.0% |

These historical synthetic measurements were documented for a specific controlled workload. They are **not transferable as claims about the current candidate's real-device performance**.

## Reproducing the fixture

```bash
node scripts/benchmark-render.mjs --baseline
node scripts/benchmark-render.mjs --optimized
npm run verify
```

The scheduler coalesces presentation requests; market ingest and alert evaluation are not intended to be deferred. The SVG chart renderer caches unchanged geometry while status/freshness must continue updating. Visibility changes, teardown and replay composition are relevant regression cases.

## Required actual-browser measurement

A customer-release performance report needs real Chromium and representative hardware, with a documented baseline and consistent workload. Measure:

- Live-feed bursts: CPU, long tasks, chart presentation latency and skipped frames.
- Narrow/wide/ultrawide layouts: responsiveness, layout shifts and pointer/keyboard interaction.
- Prolonged sessions: memory, recorded-event/IndexedDB growth, queues and tab/background transitions.
- Replay: seek/step latency and import/load responsiveness at supported size limits.
- Alert evaluation under load: state freshness and attempted notifications without duplicate triggering.

Record browser/OS, hardware, exact source SHA, duration, feed fixture/live conditions, measurement method, threshold and limitations. Do not claim improvement from a single synthetic count or a screenshot.

[Testing](docs/TESTING.md) · [Acceptance](docs/ACCEPTANCE.md) · [Architecture](docs/ARCHITECTURE.md)
