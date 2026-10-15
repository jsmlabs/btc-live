# Test strategy and verification evidence

This guide separates **deterministic repository checks**, **simulated browser checks**, and **real Chromium / live Binance acceptance**. None is interchangeable. The packaging script writes a candidate ZIP; CI checks ZIP integrity, runtime-only file paths and build reproducibility. Superseded CI runs on the same ref are cancelled.

## Automated commands

Run from the repository root with Node.js >=20 (CI uses 22):

```bash
npm run verify
npm run release:check
npm run package:extension
```

`verify` performs static checks and deterministic Node tests, rejecting symbolic links in the source tree. Individual JavaScript syntax checks have a 10-second timeout; each Node test file runs in a separate process with a 20-second timeout. All test files are attempted, and any failure or timeout makes verification fail. This provides a file-specific diagnosis instead of an opaque aggregate timeout. `release:check` validates the candidate's static release contract. `package:extension` reruns source verification and builds `dist/btc-live-chromium-v1.22.0-candidate.zip`; CI validates archive integrity. These do not install the extension into Chromium or test a real Binance connection.

**Integrated-main CI regression (2026-10-15):** The first bounded main run failed, exposing legacy chart preference assertions that ignored newly added default fields and a chart freshness assertion that expected a live label for a stale stream. The test fixtures have been updated to reflect actual intended contracts. Additional CI evidence identified outdated `1h` rejection expectations and legacy chart runtime tests that generated OHLCV from ticker trades and opened uncontrolled sockets. Tests now use isolated adapters and verify the exchange-origin candle boundary. This is not a passing CI claim; check the current branch workflow.\n\n**Historical evidence:** The isolated Phase-10 candidate reported 45/45 deterministic tests and static/package checks passing. The candidate is now in `main`, with additional files and changes; run the entire suite and check CI for the exact current `main` commit. Do not quote that historical count as a current CI result.

## Manual acceptance matrix

| Scenario | Expected observable behavior | Evidence required |
| --- | --- | --- |
| Chromium load | Unpacked extension loads; popup and dashboard render without material console errors | Browser/build, screenshots, console |
| Narrow viewport, input and accessibility | No clipped primary controls; visible keyboard focus; chart gestures and undo/redo work | Viewport/steps, interaction record |
| Market startup and dropout | Feed status matches freshness, not merely socket connectivity | Timestamped status and reconnect logs |
| Depth sequence gap and snapshot race | Invalid dependent depth metrics are withheld until valid resync | Gap/snapshot trace |
| Missing or stale trades | CVD/volume-dependent values withheld, not silently replaced with zero | Controlled gap evidence |
| Alerts and denial | Allowed and denied notifications are handled; failed attempts are not misreported as delivered | Permission, trigger and history log |
| Duplicate tabs and locks | Rules do not intentionally double-attempt under cooperating tabs; missing Web Locks fails closed | Two-tab steps and stored state |
| Dashboard closure and MV3 restart | Advanced rules do not imply ongoing closed-page evaluation; sampled background checks follow browser scheduling | Lifecycle steps and timestamps |
| Replay isolation | Seeking/playing recorded data never fires live trading alerts | Replay fixture and alert history |
| Prolonged sessions | Memory, CPU, rendering and event backlog remain acceptable to defined budgets | Hardware, duration, traces, thresholds |
| Existing install/update | Existing storage and settings are retained or migrated per documented contract | Before/after snapshot |

Document each run with: **commit SHA, UTC date, OS/browser build, Node version if applicable, steps/fixture, expected result, actual result, evidence link and pass/fail/block status**. Redact sensitive local information.

## Failure handling

- A failed or skipped test is **not passed**. Record owner and blocker rather than hiding the result.
- A mocked WebSocket or DOM test is not evidence of real Binance availability.
- A screenshot or illustrative concept graphic is not a substitute for a repeatable interactive check.
- Do not claim numerical performance gains without a comparable baseline, workload and measurements.
- Before approval, reconcile the candidate with `main`, rerun the complete suite at the final head and retain CI evidence.

See [Release readiness](RELEASE.md), [Alert semantics](ALERTS.md) and any prior [smoke checklist](SMOKE-TEST.md).
