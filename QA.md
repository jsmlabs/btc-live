# BTC Live v1.13.0 manual QA

Use this checklist after loading the project directory through `chrome://extensions` with Developer mode enabled.

- Popup `Open Dashboard` opens `dashboard/dashboard.html` in a separate extension tab without requesting a new permission.
- Dashboard initializes from the same validated REST/WebSocket runtime as the popup and reaches `LIVE` independently.
- Dashboard current price, 24h open/high/low, volume, range, bid/ask and spread match the same market-state semantics as the popup.
- Dashboard Feed Health shows independent Price Feed and 24h Stats freshness/source information.
- Dashboard Connection Diagnostics shows connection, session, reconnect count, backoff, last connect and last disconnect.
- Changing Compact Layout, Bid/Ask, Volume, Range or Price Animation in the dashboard updates immediately and persists.
- With popup and dashboard open together, changing a display setting in either view updates the other through local storage synchronization.
- Reset defaults from the dashboard restores display settings without clearing session diagnostics.
- Reset diagnostics from the dashboard clears session telemetry without changing display settings.
- Dashboard layout remains usable at desktop, tablet-width and narrow browser widths with no horizontal overflow.
- Dashboard range progress exposes numeric `aria-valuenow` only when valid range data exists.

- Popup opens without console errors.
- Initial REST snapshot populates price, 24h open/high/low, range, bid/ask, spread and volume.
- Status becomes `LIVE` after validated WebSocket data arrives.
- Compact Layout defaults off when migrating from an older settings object and persists after being enabled.
- Compact Layout reduces main-view spacing without hiding price, 24h cards, range, bid/ask, volume or footer content that is otherwise enabled.
- Switching Compact Layout off restores Comfortable spacing immediately.
- 24h Range exposes LOW/HIGH visual endpoints and the progress element reports a numeric `aria-valuenow` when data exists.
- With no valid range position, the range progress element removes `aria-valuenow` and reports a waiting description.
- During automatic reconnect backoff, the main state message shows the rounded countdown until the next retry.
- Manual recovery control reads `Retry now` and triggers immediate recovery when connectivity exists.
- Connection status exposes an accessible `Connection status: <STATE>` label.
- If the price stream remains fresh while 24h statistics age past their freshness threshold, status becomes `DEGRADED` rather than `STALE`.
- Fresh 24h ticker data recovers `DEGRADED` back to `LIVE`.
- If the displayed price itself becomes stale, status becomes `STALE` and controlled reconnect recovery follows.
- Footer identifies `LIVE · TRADE`, `LIVE · TICKER` or `REST SNAPSHOT` according to the displayed price source.
- Footer shows separate `Price` and `Stats` ages based on Binance exchange timestamps.
- Settings diagnostics shows connection state, session age, price feed health, 24h-stat health, reconnect count, active backoff, last connect and last disconnect reason.
- Reconnect count and last disconnect information survive closing/reopening the popup within the same browser session.
- Reset diagnostics clears session telemetry without changing display settings or interrupting a healthy connection.
- Closing and restarting the browser clears session diagnostics automatically.
- Price updates without reopening the popup and does not jump backward from duplicate, delayed or lower-sequence data.
- A ticker event sharing a millisecond with a trade may advance the displayed price only when its Binance last-trade ID is newer.
- An equal-sequence REST snapshot does not overwrite live WebSocket 24h statistics.
- A REST snapshot with a later close timestamp but older last-trade ID does not replace a newer live price.
- Internally inconsistent Binance 24h change/open/last data is rejected rather than rendered.
- Price flash follows actual displayed-price changes and disappears when Price Animation is disabled.
- Bid/Ask, Volume and 24h Range settings hide/show their sections and persist after reopening.
- Rapidly toggling multiple settings persists the final UI state without reverting to an earlier write.
- Reset defaults restores all five display settings without clearing session diagnostics.
- Escape closes Settings and returns focus to the Settings button.
- Disconnecting the network transitions to `OFFLINE`; reconnecting recovers automatically.
- A WebSocket error while the browser remains online immediately enters controlled `RECONNECTING` recovery even if a close event is delayed.
- An unexpected WebSocket close records the local close reason/code in session diagnostics.
- If 24h ticker updates stop while trades continue, the extension reports degradation and reconnects rather than leaving bid/ask, range and volume silently stale.
- Delayed exchange events older than the freshness threshold cause `STALE` even if they were only just received locally.
- With reduced-motion enabled at OS/browser level, transitions and flashes are effectively suppressed.
- `npm run release:check` passes and creates exactly the declared 35 runtime files in `dist/btc-live-chromium-v1.13.0-store`.
- No account, API key, analytics, tracking request or unexpected host permission is present.

## v1.9.0 Step 1 chart checks

- [ ] Dashboard chart loads with validated BTCUSDT candles.
- [ ] 1m / 5m / 15m switches reload the correct interval.
- [ ] Candles / Line switch does not trigger a network reload.
- [ ] Volume toggle expands/collapses the price plotting area correctly.
- [ ] Current candle advances from live price updates.
- [ ] 24h open/high/low and LIVE reference values render.
- [ ] Chart preferences survive dashboard close/reopen.
- [ ] Chart failure leaves the rest of BTC Live operational and exposes Retry chart.

## v1.9.0 hardening regression

- [ ] `npm run verify` completes with all 96 deterministic tests passing.
- [ ] `npm run release:check` builds the explicit runtime allowlist without extra files.
- [ ] Invalid chart runtime configuration fails before network or timer side effects.
- [ ] Malformed kline interval boundaries are rejected rather than rendered.
- [ ] Rapid settings changes never expose unsanitized values in popup or dashboard.


## v1.10.0 notification checks

- [ ] Browser Notifications default to off after upgrade from earlier settings.
- [ ] Test notification produces a native Chromium notification from both popup and dashboard.
- [ ] Enabling Browser Notifications allows native Chromium notifications without adding a background service worker.
- [ ] Price Move Alerts trigger only after the configured movement from the persisted alert anchor.
- [ ] Price thresholds 0.1%, 0.25%, 0.5%, 1%, 2% and 5% persist across popup/dashboard reopen.
- [ ] A price notification advances the anchor so the same move is not repeatedly alerted.
- [ ] Cooldown prevents repeated alerts from noisy state changes.
- [ ] OFFLINE or STALE transitions can generate a connection alert when enabled.
- [ ] Recovery to LIVE after an issue can generate a recovery alert.
- [ ] Popup and dashboard use stable notification IDs/shared state rather than intentionally emitting independent duplicate alerts.
- [ ] Disabling Browser Notifications suppresses both price and connection notifications.
- [ ] Notification API failures do not interrupt market updates or rendering.
- [ ] Manifest permissions are exactly `storage` and `notifications`; Binance remains the only host permission.

## v1.11.0 background alert checks

- Enable Browser Notifications, Background Alerts and Price Move Alerts, then close popup/dashboard and verify the service-worker alarm remains configured.
- Confirm a qualifying background price move creates one native notification and advances the shared alert anchor.
- Open dashboard and popup together and confirm a qualifying move does not produce duplicate alert events from stale per-view state.
- Disable Browser Notifications or Background Alerts and verify the periodic alarm is cleared.
- Confirm transient background REST failures are contained and do not emit connection-health notifications.


## v1.12.0 alert-control checks

- [ ] Above Price Alert accepts a valid USDT target, triggers at/above it, and remains silent while price stays above it.
- [ ] Above Price Alert re-arms after price falls back below the configured target and can trigger on a later recross.
- [ ] Below Price Alert mirrors the same behavior in the opposite direction.
- [ ] Invalid or empty target values are sanitized and cannot activate a background target alert.
- [ ] Alert Cooldown persists and supports 1, 5, 15, 30 and 60 minute presets.
- [ ] When an explicit target and percentage threshold are both reached in one snapshot, only the explicit target notification is emitted.
- [ ] Background Alerts remain scheduled when percentage alerts are disabled but a valid Above or Below target alert is enabled.
- [ ] Concurrent background invocations share one in-flight REST check rather than issuing duplicate requests.
- [ ] Popup and dashboard target controls remain synchronized through local storage.

## v1.13.0 alert manager checks

- [ ] Existing enabled v1.12.0 Above/Below targets appear once in the new target manager after upgrade.
- [ ] Add multiple Above and Below targets with optional labels from popup and dashboard.
- [ ] Enable/disable and remove a target; changes synchronize between open views and background scheduling.
- [ ] Each target fires only once while price remains beyond it, then re-arms only after price moves back across the target.
- [ ] A price jump across multiple armed targets creates at most one native target notification for that snapshot and marks all reached targets triggered.
- [ ] Alert History records sent target, price-move and connection notifications with source context.
- [ ] Simultaneously reached but non-delivered targets are recorded as `SUPPRESSED` instead of being delivered later.
- [ ] Alert History keeps at most 100 persisted events and Clear history removes all entries without changing targets/settings.
- [ ] Disabling all price-move alerts and all target rows stops the background alarm; enabling any target reconciles it again.
