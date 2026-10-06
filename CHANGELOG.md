## 1.14.0 - 2026-10-06

### Changed
- Migrated BTCUSDT REST snapshots, live trades, 24h ticker statistics and chart klines from Binance Spot to Binance USDⓈ-M Futures.
- Replaced Spot `trade` events with Futures `aggTrade` events for the live price path.
- Split Futures WebSocket ingestion across the current market-data route for aggregate trades/24h ticker and the public route for `bookTicker`.

### Improved
- Preserved Top of Book and spread metrics by sourcing bid/ask independently from the Futures book-ticker feed instead of assuming those fields exist on the Futures 24h ticker.
- Added independent ordering/state ownership for book updates so stale REST snapshots cannot overwrite newer live Futures bid/ask values.
- Added Futures endpoint, validation and regression coverage, including guards against restoring legacy Spot network endpoints.

### Compatibility
- Keeps existing settings, alert stores, diagnostics, DOM IDs, notification behavior and zero-runtime-dependency architecture unchanged.
- Network access remains Binance-only and is narrowed to the USDⓈ-M Futures REST/WebSocket endpoints.

## 1.13.4 - 2026-10-06

### Fixed
- Removed the wide-screen vertical dead zones caused by coupling short market cards to taller diagnostics/alert cards in shared CSS Grid rows.
- Restored independent market and utility stacks so 24H Range, Top of Book, Connection Diagnostics and Price Targets flow without artificial row-height gaps.
- Moved Alert History and Display Settings into a dedicated lower utility grid, preserving all existing element IDs and behavior while improving visual balance.
- Bounded the live chart height on large displays so ultrawide width no longer makes the chart disproportionately tall.

### Improved
- Reduced the dashboard workspace cap from 2200px to 1840px for stronger information density and more readable typography on large/ultrawide displays.
- Increased panel/header legibility, refined surface contrast and shadow depth, and retained responsive single-column behavior on narrow widths.
- Display Settings remains two-column on wide screens and collapses cleanly at smaller breakpoints.

### Compatibility
- No market-data logic, alert logic, storage schema, permissions, runtime contracts or dashboard element IDs changed.

## 1.13.2 - 2026-10-06

### Fixed
- Removed the overly narrow 1440px desktop dashboard cap that produced excessive unused space on wide and ultrawide displays.
- Rebalanced the lower dashboard into a 12-column desktop composition so the long settings/alerts sidebar no longer leaves a large empty market column.
- Arranged dashboard settings in two columns on wide screens to reduce unnecessary vertical height while retaining existing responsive layouts below 1180px.

### Compatibility
- Preserves all existing dashboard element IDs, settings behavior, alert behavior, permissions and runtime contracts.

## 1.13.1 - 2026-10-06

### Fixed
- Contained native-notification failures for percentage-move and connection alerts so a rejected Chromium notification request cannot abort snapshot processing.
- Persist failed percentage-move and connection notification attempts in alert history with explicit failure reasons, matching target-alert failure handling.
- Made runtime startup concurrency-safe: simultaneous `start()` callers now share and await the same initialization instead of receiving a partially initialized snapshot.
- Sanitized settings returned by injected/custom load adapters before they can enter runtime state.

### Verification
- Expanded deterministic regression coverage from 96 to 100 tests.

## 1.13.0 - 2026-10-06

### Added
- Multi-target BTC price alert manager with independent direction, price, optional label, enabled state and persistent trigger/re-arm state.
- Local alert history capped at 100 events, including sent, suppressed and failed outcomes plus originating extension context.
- Popup and dashboard controls for adding, enabling/disabling, removing and reviewing price targets, plus clearing history.

### Improved
- Existing v1.12.0 Above/Below targets migrate automatically into the multi-target store on first access.
- Simultaneous target crossings are handled deterministically: a single native target notification is prioritized while all reached targets transition to triggered state.
- Background scheduling now reacts to target-store changes as well as general settings changes.
- Alert configuration/history are isolated from general settings storage for safer evolution and clearer ownership.

## 1.12.0 - 2026-10-06

### Added
- Absolute `Above` and `Below` BTC/USDT target alerts with dedicated controls in popup and dashboard.
- Configurable notification cooldown presets from 1 to 60 minutes.
- Persistent target-state tracking with deterministic re-arm behavior after price crosses back over a target.

### Improved
- Explicit target notifications take precedence over generic percentage-move alerts for the same market snapshot.
- Background scheduling now activates for any enabled price-alert mode.
- Concurrent service-worker checks are coalesced into a single in-flight REST request.
- Settings and notification-state sanitizers migrate prior versions safely with bounded absolute-price inputs.
- Regression coverage expanded to 90 deterministic tests.

## 1.11.0 - 2026-10-06

- Added persistent background price-alert scheduling with an MV3 module service worker and Chromium alarms.
- Added background-alert settings and dependent-control state in popup and dashboard.
- Hardened notification coordination across extension contexts by refreshing persisted state and using Web Locks when available.
- Added background alert controller coverage and duplicate-alert regression coverage.
- Expanded the explicit store runtime allowlist for the background runtime.

## 1.10.0 - 2026-10-06

### Added
- Native Chromium browser notifications with an explicit master enable/disable setting and one-click test notification.
- Configurable BTC price-move alerts using a persisted notification anchor and selectable 0.1%-5.0% thresholds.
- Connection-state alerts for offline/stale market data plus recovery notifications when validated live data returns.
- Shared persisted notification state to reduce duplicate alerts across simultaneously open popup and dashboard views.
- Notification cooldown protection, deterministic state sanitization and dedicated regression coverage.

### Improved
- Popup and dashboard settings now expose the same notification controls and synchronize through the existing settings storage contract.
- Notification failures are isolated from the market runtime and cannot interrupt price monitoring, rendering or reconnection.
- Release verification and store packaging explicitly include the notification runtime and `notifications` permission.

### Architecture
- No persistent background service worker was added. Notifications are generated while the popup or dashboard is active, preserving the existing lightweight MV3 lifecycle.
- No new host permissions, external services, analytics, accounts, API keys or runtime dependencies were introduced.

## 1.9.0 - In development

### Step 1/7 - Live BTC Chart

- Added lightweight dashboard BTCUSDT chart with no third-party chart dependency.
- Added 1m, 5m and 15m Binance Spot kline intervals.
- Added candlestick and line display modes plus optional volume bars.
- Added live active-candle updates from the existing shared market runtime.
- Added 30-second REST kline reconciliation for OHLC and volume consistency.
- Added live / 24h open / 24h high / 24h low chart reference levels.
- Added persistent dashboard-local chart preferences.
- Added validation, runtime, preference and geometry regression tests.

### Hardened
- Sanitized optimistic and persisted settings before they can reach either UI.
- Added fail-fast chart runtime validation for unsafe limits, refresh cadence and adapter configuration.
- Added Binance kline interval-boundary validation to reject structurally malformed candle payloads.
- Made popup/dashboard teardown explicitly idempotent across page lifecycle events.
- Expanded release verification for semantic versions, document language/viewport metadata and unexpected extension execution surfaces.
- Expanded regression coverage from 73 to 76 deterministic tests.

# Changelog

## 1.8.0 - 2026-10-06

### Added
- Full-page BTC Live Dashboard for desktop/laptop monitoring.
- Popup `Open Dashboard` action that opens the extension dashboard in its own browser tab.
- Dedicated dashboard panels for current price, 24h statistics, range position, top-of-book, feed health, connection diagnostics and display settings.
- Deterministic tests for the shared runtime contract and dashboard rendering.

### Improved
- Market lifecycle, REST/WebSocket handling, ordering, freshness, reconnect, settings and diagnostics logic now live in one shared runtime used by both popup and dashboard.
- Popup and dashboard display settings synchronize through the existing local storage value without polling or additional permissions.
- Release verification validates popup and dashboard DOM contracts independently and packages both through the explicit fail-closed runtime allowlist.
- Responsive dashboard layout scales from desktop to narrow browser windows while preserving the same market-state semantics.

### Preserved
- Existing v1.7 popup behavior and display settings.
- Manifest V3 architecture and the v1.6+ resilience/observability state machine.
- `storage` as the only extension permission.
- Binance public API as the only host permission.
- No analytics, tracking, account, API key, service worker or runtime dependency.

## 1.7.0 - 2026-10-06

### Added
- Persisted Compact Layout preference for a denser main monitoring view without removing market information.
- Accessible 24h range progress semantics with numeric position and descriptive screen-reader text.
- Explicit low/high endpoints on the 24h range visualization.
- Main-view reconnect countdown showing when the next automatic retry will occur.
- Deterministic render coverage for layout density, range accessibility and reconnect countdown behavior.

### Improved
- Settings from earlier releases migrate to Comfortable layout by default without changing existing display preferences.
- Connection status now exposes an explicit accessible label in addition to the visible status text.
- Manual recovery control is labeled `Retry now` to distinguish it from automatic backoff recovery.
- Compact mode reduces spacing and card padding while keeping the same data, state model and interaction contracts.

### Preserved
- Manifest V3 architecture and the v1.6 resilience/observability state machine.
- `storage` as the only extension permission.
- Binance public API as the only host permission.
- No analytics, tracking, account, API key, service worker or runtime dependency.

## 1.6.0 - 2026-10-06

### Added
- Explicit connection state machine with a dedicated `DEGRADED` state between fully live and stale operation.
- Independent price-feed and 24h-stat health classification.
- Session-only reconnect telemetry using `chrome.storage.session`: reconnect count, last successful connect, last disconnect timestamp and reason.
- Current reconnect/backoff diagnostics and manual session-diagnostics reset.
- Deterministic tests for connection transitions, degraded recovery, session telemetry persistence/reset and expanded diagnostics rendering.

### Improved
- A healthy live price with delayed 24h statistics is reported as `DEGRADED` instead of conflating partial degradation with stale price data.
- Connection status changes now pass through one transition contract rather than being assigned ad hoc across lifecycle callbacks.
- Unexpected WebSocket closes preserve their close code/reason in local session diagnostics.
- Reconnect telemetry persists across popup reopenings but automatically disappears when the browser session ends.
- Session-diagnostics writes are serialized so an earlier slow write cannot overwrite a newer diagnostic state.

### Preserved
- Manifest V3 architecture.
- `storage` as the only extension permission.
- Binance public API as the only host permission.
- No analytics, tracking, account, API key, service worker or runtime dependency.

## 1.5.0 - 2026-10-03

### Added
- Connection Diagnostics panel in Settings showing connection state, current price-feed source/freshness, 24h-stat source/freshness and active reconnect attempt state.
- Cross-field validation for Binance 24h absolute and percentage price changes.
- Explicit positive-finite validation for REST request timeouts.
- Explicit 18-file runtime allowlist for store packaging.

### Improved
- WebSocket error events now enter controlled reconnect recovery immediately rather than depending on a subsequent close event.
- Status accessibility now exposes the connection pill as a live status region.
- Release packaging fails closed if the produced store directory differs from the declared runtime allowlist.
- Test fixtures now use mathematically coherent Binance market snapshots.

### Preserved
- Manifest V3 architecture.
- `storage` as the only extension permission.
- Binance public API as the only host permission.
- No analytics, tracking, account, API key, service worker or runtime dependency.

## 1.4.0 - 2026-10-03

### Added
- Cross-source price sequencing using Binance last-trade IDs when available.
- Separate price and 24h-stat freshness diagnostics in the popup footer.
- Serialized settings persistence for deterministic rapid preference changes.
- Receipt timestamps for trade and ticker events to preserve future diagnostics without changing the UI contract.

### Improved
- A same-millisecond ticker can advance price only when its last-trade ID is newer.
- REST snapshots with older trade sequencing cannot override newer live prices even when their close timestamp is later.
- Equal-sequence live WebSocket ticker fields take precedence over REST ticker fields.
- REST and WebSocket ticker validation now require explicit exchange timestamps and last-trade sequencing metadata.
- Global stale detection now uses the displayed price exchange-event time rather than only local receipt time.
- Price animation keys follow the displayed price sequence instead of unrelated ticker-event timestamps.

### Preserved
- Manifest V3 architecture.
- `storage` as the only extension permission.
- Binance public API as the only host permission.
- No analytics, tracking, account, API key, service worker or runtime dependency.

## 1.3.0 - 2026-10-03

### Added
- Binance trade-ID sequencing for deterministic ordering of trades sharing the same millisecond.
- Dedicated 24h ticker-stream watchdog.
- Live price-source diagnostics in the popup footer.
- Exchange-event age display for clearer freshness diagnostics.

### Improved
- Trade prices now win over equal-timestamp ticker and REST prices.
- Duplicate or out-of-order ticker updates no longer refresh connection health.
- 24h ticker validation now rejects internally inconsistent open/last versus low/high ranges.
- Store builds are staged and promoted atomically to avoid partially built release directories.
- Store packaging validates that development-only files are excluded.
- Release verification now enforces version consistency across popup, README, changelog and QA documentation.

### Preserved
- Manifest V3 architecture.
- `storage` as the only extension permission.
- Binance public API as the only host permission.
- No analytics, tracking, account, API key, service worker or runtime dependency.

## 1.2.0 - 2026-10-03

### Added
- Rolling 24h open-price metric.
- Clean store-build command through `npm run build:store`.
- Full `npm run release:check` workflow.
- Freshness-window validation for live WebSocket events.

### Improved
- Market-state ordering is now exchange-timestamp aware.
- Older ticker events cannot overwrite a newer trade price.
- Older REST snapshots cannot roll newer live ticker fields backward.
- Synchronous WebSocket construction failures enter controlled reconnect recovery.
- Online connection failures use `RECONNECTING`; `OFFLINE` is reserved for actual browser-offline state.
- Reduced-motion system preference is respected.
- Verification now checks duplicate DOM ids, local relative imports, CSP safety, dynamic-code hazards and runtime dependency absence.

### Preserved
- Manifest V3 architecture.
- `storage` as the only extension permission.
- Binance public API as the only host permission.
- No analytics, tracking, account, API key, service worker or runtime dependency.

## 1.1.0 - 2026-10-03

### Added
- 24h range-position indicator.
- Spread percentage display.
- Manual Retry control for stale, reconnecting, offline and error states.
- Persisted 24h range visibility setting.
- Reset-defaults settings action.
- Deterministic Node test suite and verification script.

### Improved
- WebSocket lifecycle isolation prevents stale socket callbacks from scheduling duplicate reconnects.
- Socket connections recover when opened but no market data arrives.
- Browser online/offline transitions are handled explicitly.
- Slow REST responses no longer overwrite fresher WebSocket prices.
- 24h ticker events can update the displayed price if trade events are temporarily absent.
- Settings migration remains backward compatible with v1.0.0 stored preferences.
- Keyboard Escape closes Settings and focus returns predictably.
