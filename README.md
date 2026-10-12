# BTC Live

BTC Live is a lightweight Chromium Manifest V3 extension for monitoring BTCUSDT using Binance USDⓈ-M Futures public market data.

## v1.22.0

- Independent reconnect/backoff for Binance Futures trade/ticker and order-book WebSockets; a book outage does not interrupt price updates.
- REST ticker remains usable when the independent book request fails. Order-book degradation is exposed in connection status.
- Suppresses price/target alerts for stale or disconnected market state, with 0.05% target rearm hysteresis against boundary oscillation.
- Saves background check timestamps and success/failure markers locally as `btcLiveBackgroundCheck`. Polling is sampled, **not continuous real-time alerting**.
- Adds targeted feed/alert regression tests and an optional Playwright-driven Chromium DOM + mocked-stream smoke test. No new permissions, network endpoints or runtime dependencies.

## v1.21.0

- Coalesces dashboard-only DOM/Chart paint requests with `requestAnimationFrame` while preserving synchronous market ingestion and alert evaluation.
- Restores pending display state when a suspended background tab becomes visible and cancels queued paints on page teardown.
- Avoids rebuilding the candle SVG when chart geometry and market reference values have not changed; status ages and level labels still refresh.
- Adds a reproducible synthetic rendering workload benchmark and eight focused regression tests.
- Consolidates store runtime files into one allowlist, updates Node.js CI to 22/24 and aligns release documentation.
- No new runtime dependencies, permissions, settings migrations, network endpoints or feature flags.

## v1.20.0

- Removes the remaining desktop dead zone between Alert History and Display Settings with a shared aligned utility grid.
- Aligns 24H Range + Top of Book with Connection Diagnostics and Alert History with Price Targets so both columns finish on the same baseline.
- Preserves the compact v1.17 visual system and responsive behavior without negative margins, fixed-height hacks or DOM contract changes.
- Keeps Binance Futures runtime, alerts, settings, diagnostics, permissions and storage behavior unchanged.

## Render-work benchmark (synthetic)

```bash
node scripts/benchmark-render.mjs --baseline
npm run bench:render
```

The deterministic workload simulates 120 market updates (two legacy visual notifications each), grouped into 4-update frames, plus 40 unchanged status refreshes with 120 chart candles. The **baseline** forces the previous unconditional SVG-rebuild policy; the **optimized** run exercises the frame scheduler and geometry cache. Compare `svgRebuilds` and `svgNodesCreated`; wall-clock timings in Node.js with a mocked DOM are diagnostic only, not Chromium FPS or real-user latency. Market processing and alerts are not throttled. See `PERFORMANCE.md` for the frozen baseline and acceptance evidence.

## v1.13.4

- Removes the remaining wide-screen dead zones by letting the market and diagnostics/alert columns flow independently instead of sharing row heights.
- Moves Alert History and Display Settings into a dedicated lower utility grid for a cleaner, more balanced workstation composition.
- Caps the desktop workspace at 1840px and bounds chart height so ultrawide displays stay dense and readable rather than stretched.
- Refines panel hierarchy, typography and surface contrast while preserving responsive tablet/mobile layouts.
- Keeps all existing dashboard controls, IDs, market logic, alert behavior, storage contracts and permissions unchanged.

## v1.13.1

- Adds a persistent multi-target alert manager with independent `Above` / `Below` BTC price targets, labels, enable/disable controls and automatic re-arming.
- Migrates existing v1.12.0 single Above/Below targets into the new target store without losing alert intent.
- Adds local alert history for sent, suppressed and failed alert events, capped at 100 entries with clear-history controls in popup and dashboard.
- Records alert source (`popup`, `dashboard`, `background`) and target context for diagnostics.
- Handles multi-target jumps deterministically: one native alert is prioritized while other simultaneously reached targets are marked triggered and recorded as suppressed instead of firing late.
- Keeps the existing Manifest V3 permission surface and zero runtime dependencies.

## v1.12.0

- Adds absolute BTC price-target alerts for `Above` and `Below` USDT levels in popup and dashboard.
- Target alerts re-arm only after price moves back across the configured level, preventing repeated notifications while price remains beyond a target.
- Adds configurable 1 / 5 / 15 / 30 / 60 minute alert cooldown controls.
- Gives explicit price targets priority over generic percentage-move alerts when both conditions become true in the same snapshot.
- Background scheduling now remains active when any price-alert mode is enabled, not only percentage-move alerts.
- Coalesces overlapping service-worker checks so concurrent alarm/settings events cannot trigger duplicate REST requests.
- Keeps Manifest V3, the same Binance-only host permission, zero runtime dependencies and the existing permission set.

## v1.11.0

- Adds an MV3 background service worker and Chromium `alarms` scheduling for persistent BTC price alerts when popup and dashboard are closed.
- Adds a `Background Alerts` setting; background checks run only when notifications, background alerts and price-move alerts are enabled.
- Reuses the same validated Binance REST snapshot and notification anchor/cooldown state as active views.
- Serializes notification state with the Web Locks API when available and refreshes persisted state before evaluation to reduce cross-context duplicate alerts.
- Keeps connection-health notifications tied to active live views; the background poller does not convert transient REST failures into connection alerts.
- Disables dependent notification controls when the master notification switch is off.
- Keeps zero runtime dependencies and adds only the `alarms` permission required for persistent scheduling.

## v1.10.0

- Adds native Chromium notifications for BTC price moves and market-data connection issues.
- Adds configurable price thresholds, connection/recovery alerts and shared cooldown/deduplication state.
- Notifications are opt-in and operate while the popup or dashboard is active; no persistent background worker is introduced.
- Adds a full-page extension dashboard at `dashboard/dashboard.html` for persistent desktop monitoring.
- Adds an `Open Dashboard` control to the popup while preserving the popup as the fast compact view.
- Extracts market lifecycle, reconnect, freshness, settings and diagnostics behavior into one shared runtime used by both popup and dashboard.
- Adds dashboard feed-health, market statistics, range, top-of-book, diagnostics and display-settings panels.
- Synchronizes display settings between open popup and dashboard views through the existing local storage key.
- Keeps Manifest V3, the existing Binance public endpoints, `storage` and `notifications` as the only extension permissions and zero runtime dependencies.

## Development verification

Requires Node.js 22 or newer. CI verifies Node.js 22 and 24.

```bash
npm run verify
```

For a full release check and clean store directory:

```bash
npm run release:check
```

The generated extension is written to `dist/btc-live-chromium-v1.22.0-store`.

## Privacy and permissions

BTC Live stores display preferences locally and temporary connection diagnostics in browser-session storage and connects only to Binance public market-data endpoints. It does not use an account, analytics, tracking, API keys or runtime dependencies.

## v1.9.0 chart checkpoint retained in v1.22.0

The dashboard now includes a lightweight BTCUSDT live chart without external runtime dependencies.

- 1m / 5m / 15m intervals
- Candlestick and line modes
- Optional volume bars
- Live price updates from the shared BTC market runtime
- Periodic Binance USDⓈ-M Futures kline reconciliation
- Live, 24h open, 24h high and 24h low reference levels
- Dashboard-local persistent chart preferences

Steps 2-6 of the v1.9.0 product scope are intentionally not included in this checkpoint.
