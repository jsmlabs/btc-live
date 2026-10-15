# Phase 03 - Architecture & Observability

## Scope

A bounded, dependency-free, read-only runtime telemetry component separates event accounting from socket orchestration. It exposes `snapshot().telemetry` alongside the pre-existing runtime snapshot. Existing `state`, `settings`, `diagnostics` and feed connection fields remain unchanged. This is an additive interface.

## Telemetry contract

- Explicit event allowlist and fixed-size recent-event buffer (default 64).
- Lifetime counters persist within the runtime instance even after the ring buffer rotates.
- Records contain sequence, local timestamp, event type, and restricted numeric/status metadata only.
- No raw WebSocket frames, URLs, error text, settings, credentials or market payloads are retained.
- `snapshot()` returns detached copies; consumers cannot mutate internal counters/history.
- Live and Replay computations remain unchanged. No UI replacement or broad refactor was justified by the current source.

## Verification

Run `npm run verify`. Test coverage includes telemetry bounds, allowlist, isolation and runtime integration (snapshot success/failure, socket events and lifecycle). Browser integration and measured render timings are **not** established; browser smoke checklist remains required.

## Deferred from phase 03

Render-duration and event-queue profiling require measured Chromium baseline and a defined performance budget. A shared Live/Replay calculation pipeline requires mapping replay data fidelity first, to avoid introducing superficially shared but semantically different calculations. Neither has been claimed as complete.
