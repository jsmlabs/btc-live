# Performance verification

BTC Live uses a rendering scheduler and chart-geometry reuse to reduce avoidable presentation work. **No verified end-to-end Chromium CPU, memory, frame-rate or latency improvement is claimed for the current candidate.** Performance approval requires observations from the actual extension in a real browser.

## Automated checks

Run `npm run verify` for deterministic behavior tests and the following optional synthetic workload comparisons:

```bash
node scripts/benchmark-render.mjs --baseline
node scripts/benchmark-render.mjs --optimized
```

The fixture uses a substitute DOM and controlled market-update input. Its operation counts do not measure actual rendering time, device load, memory consumption, power efficiency or alert-delivery latency.

## Required Chromium measurement

| Scenario | Measure | Required context |
| --- | --- | --- |
| Sustained real-market session | CPU, memory, errors and state freshness | OS, browser, hardware, tested SHA, duration and feed source |
| Burst market updates | Long tasks, frame behavior, render backlog | Repeatable workload and thresholds |
| UI interactions | Chart pointer/zoom responsiveness, keyboard and focus | Supported screen widths and input devices |
| Hidden/visible transitions | Recovery of queued presentation and lifecycle cleanup | Tab visibility and worker state |
| Recording and replay | Capture growth, seek/step times and import responsiveness | Recording size and coverage |
| Alerts under load | Trigger timing, deduplication and attempts | Notification permissions and feed validity |

Record objective, acceptance budget, duration, raw observations, failure cases and decision. Compare like-for-like conditions and avoid unmeasured claims of improved performance.

## Release decision

Sustained-load and replay tests remain part of [customer-release acceptance](docs/ACCEPTANCE.md). A successful Node suite or synthetic chart workload does not close them.

[QA](QA.md) · [Testing](docs/TESTING.md) · [Architecture](docs/ARCHITECTURE.md)
