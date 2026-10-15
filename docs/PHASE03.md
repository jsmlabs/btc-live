# Phase 03 - architecture and observability

**Historical engineering record.** Phase 03 added bounded read-only runtime telemetry; it did **not** certify the performance of a production browser release.

## Added telemetry contract

The telemetry component exposes a separate `snapshot().telemetry` value without replacing existing state, settings, diagnostics or feed connection fields.

| Capability | Design boundary |
| --- | --- |
| Event tracking | Explicit event-name allowlist |
| Recent history | Fixed-size circular buffer, default **64** records |
| Counters | Lifetime counts for the runtime instance |
| Details | Sequence, timestamp, status and restricted numeric metadata only |
| Sensitive content | No raw WebSocket frames, URLs, settings, credentials or unfiltered errors |
| Consumers | Detached snapshot copies to prevent UI mutation of internal state |

Runtime integration and failure/success paths were covered by deterministic tests. Neither the telemetry reader nor the UI is a trust authority for exchange-data validity.

## Deliberately deferred

Real Chromium render times, event-queue profiling, CPU/memory budgets and complete shared Live/Replay computation need measured browser baselines and explicitly mapped replay fidelity. They were **not** completed merely by adding instrumentation.

[Performance](../PERFORMANCE.md) · [Architecture](ARCHITECTURE.md) · [Phase 04](PHASE04.md)

