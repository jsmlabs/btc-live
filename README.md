# BTC Live

BTC Live is a lightweight Chromium Manifest V3 extension for monitoring BTCUSDT using Binance USDⓈ-M Futures public market data.

## v1.14.0

- Migrates the complete BTC market-data path from Binance Spot to Binance USDⓈ-M Futures (`BTCUSDT`).
- Uses Futures aggregate trades for live price updates and the Futures 24h ticker for market statistics.
- Keeps Top of Book and spread data accurate through the dedicated Futures `bookTicker` stream and REST fallback.
- Migrates dashboard chart reconciliation to Futures klines so chart candles and live price originate from the same market.
- Updates extension host permissions/CSP to the Futures-only Binance endpoints and adds verification guards against accidental Spot endpoint regressions.
- Preserves the existing alert, settings, diagnostics, storage and UI contracts with zero runtime dependencies.

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

Requires Node.js 20 or newer.

```bash
npm run verify
```

For a full release check and clean store directory:

```bash
npm run release:check
```

The generated extension is written to `dist/btc-live-chromium-v1.14.0-store`.

## Privacy and permissions

BTC Live stores display preferences locally and temporary connection diagnostics in browser-session storage and connects only to Binance public market-data endpoints. It does not use an account, analytics, tracking, API keys or runtime dependencies.

## v1.9.0 chart checkpoint retained in v1.14.0

The dashboard now includes a lightweight BTCUSDT live chart without external runtime dependencies.

- 1m / 5m / 15m intervals
- Candlestick and line modes
- Optional volume bars
- Live price updates from the shared BTC market runtime
- Periodic Binance USDⓈ-M Futures kline reconciliation
- Live, 24h open, 24h high and 24h low reference levels
- Dashboard-local persistent chart preferences

Steps 2-6 of the v1.9.0 product scope are intentionally not included in this checkpoint.
