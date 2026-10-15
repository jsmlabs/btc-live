# Verification and test evidence

## Deterministic checks

```bash
npm run verify
npm run release:check
npm run package:extension
```

The Phase 10 candidate previously completed **45/45 deterministic tests** along with static JavaScript syntax, local import/reference and manifest checks. Rerun locally and in CI; passing isolated tests is not evidence of browser acceptance. No third-party npm package installation is needed for this candidate.

## Browser acceptance - not yet verified

- Load unpacked MV3 extension in supported Chromium; inspect console errors and popup/dashboard rendering.
- Check responsive layout, focus, keyboard shortcuts, drawing, OHLC snap, pointer cancel and undo/redo.
- Exercise Binance REST/WS outages, stale trade feeds, depth sequence gaps, reconnects and snapshot races.
- Test notifications allowed/denied, duplicated tabs, Web Locks, browser restart and MV3 worker suspension.
- Test replay stepping, session integrity and live-alert isolation.
- Run long sessions with render timing, memory, CPU and event-backlog monitoring on representative hardware.

Record browser version, fixture/steps, expected behavior, actual outcome, logs without secrets and date for every pass/fail. See `SMOKE-TEST.md` for the earlier manual checklist. A headless Chromium start showing `about:blank` does **not** confirm extension loading.

## Release gate

Keep manifest `1.22.0` and mark v16 as RC until the listed browser and live integration gates have evidence. Do not fabricate performance improvements or trade-signal accuracy. Retain failing checks as blockers rather than silently skipping.
