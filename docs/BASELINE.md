# Phase 01 baseline and interface inventory

## Provenance and versions

- Input: `btc-live-analytics-v15.1-partial-extension(1).zip`, explicitly labelled **partial-extension**.
- Manifest version `1.22.0`; UI footer `V1.22.0`. Preserve version until release policy is agreed.
- 63 original files; SHA-256 file-by-file baseline recorded in `baseline.json`.
- Chromium Manifest V3 extension; main entries: `popup/popup.html`, `background/service-worker.js`; dashboard at `dashboard/dashboard.html`.

## Trust and permissions

- Permissions: `storage`, `notifications`, `alarms`.
- Host permission: `https://fapi.binance.com/*`.
- CSP: self-hosted scripts, Binance Futures HTTPS and WSS endpoints.
- Background MV3 worker is not guaranteed to remain resident.

## Module contracts (static inventory)

| Component | Primary responsibility / contract |
| --- | --- |
| `market/validators.js` | Normalize and validate REST, trade, ticker and book ticker data |
| `market/binance-depth.js` | Validate depth events / snapshots; sequence local book updates; expose independent depth runtime |
| `market/market-state.js` | State transitions and freshness / health derivation |
| `app/runtime.js` | Startup, socket lifetime, reconnect, settings/diagnostics and event callbacks |
| `background/service-worker.js` | MV3 lifecycle and background alert coordination |
| `storage/*.js` | Persistent user preferences, alerts, diagnostics and replay sessions |
| `ui/event-replay.js` and `ui/market-recorder.js` | Recording and deterministic / sampled replay logic |
| `ui/confluence.js` | Descriptive, non-predictive sample confluence |
| `ui/chart*.js`, `ui/*render*.js` | Chart math/interactions, rendering and scheduling |
| `dashboard/dashboard.js`, `popup/popup.js` | UI initialization and event wiring |

## User-facing areas

Live chart, Analytics (Depth, Trades, Liquidity / Order Flow), Replay, Alerts, Diagnostics and Settings. Workspace and view availability depends on actual UI state and preferences; verify manually.

## Known gaps and constraints

1. No original test suite or README in the input archive. Phase 01 adds baseline tests.
2. No browser-integrated test harness in the input; explicit manual checklist added, not falsely claimed executed.
3. No standalone release version policy; `v15.1` archive name conflicts with manifest `1.22.0`.
4. Live endpoints, service-worker lifecycle, browser rendering, and notification permissions require real browser testing.
5. Data contracts and storage migrations need deeper per-module inventory before later phases modify schemas.

## Baseline protection

Phase 01 only adds developer artifacts. Do not change source modules as part of setting up tests; require explicit regression review for later edits.
