# Chromium smoke-test worksheet

**Execution status: not yet accepted.** Perform this on the actual built extension in a **separate browser profile**; mock socket tests do not qualify as real MV3/live-data acceptance. Record all results explicitly instead of checking unrun boxes.

**Run metadata:** tested Git SHA: ______ · package SHA-256: ______ · UTC date/time: ______ · OS: ______ · Chromium version: ______ · tester: ______.

## Install and interface

- [ ] Extract the verified candidate ZIP and use `chrome://extensions` → **Load unpacked**; no manifest/load errors.
- [ ] Inspect the extension service-worker console, then open toolbar popup and full dashboard.
- [ ] Navigate Live, Analytics, Replay, Alerts, Diagnostics and Settings; test workspace presets.
- [ ] Use chart intervals/styles, crosshair, zoom, pan, drawing undo/redo, optional Alt snapping and keyboard commands.
- [ ] Test narrow/desktop/ultrawide widths, focus indicators, clipping, reduced motion and display density.

## Live market and validity

- [ ] Verify real Binance Futures REST/WS sources, timestamps and feed age; capture healthy startup evidence.
- [ ] Disconnect/reconnect networks and selectively degrade endpoints; verify stale and partial-source status.
- [ ] Cause/test delayed depth snapshots and diff sequence gaps; book-dependent metrics must be suppressed until valid resync.
- [ ] Check stale/incomplete aggressive trade windows and candle source identity; do not interpret unavailable values as zeros.

## Lifecycle, alerts and persistence

- [ ] Test standard price rules and sampled background behavior through browser sleep/restart.
- [ ] Test advanced dashboard-only rules with valid/invalid live inputs; verify replay never notifies.
- [ ] Test notification permission granted/denied and record attempted vs delivered outcome.
- [ ] Test two concurrent dashboard tabs, Web Locks behavior, cooldown/arming and MV3 worker suspend/restart.
- [ ] Test local recording, bounded replay import and errors; verify no partial application after invalid import.
- [ ] Test a sustained representative workload, recording browser CPU, memory, rendering and backlog.
- [ ] Test upgrading from an actual prior installed release with sanitized before/after settings, and rollback.

## Outcome and evidence

For each line retain **expected**, **observed**, **PASS / FAIL / BLOCKED**, timestamp and trace/screenshot URL. Do not upgrade the overall status when any gate is missing. Add evidence to the external [release approval](ACCEPTANCE.md) only after review.

[Testing](TESTING.md) · [User guide](USAGE.md) · [Release guide](RELEASE.md)
