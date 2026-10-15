# BTC Live v1.22.0 - historical stable release notes

> This file documents the existing **v1.22.0 stable baseline**. It does **not** describe a released v16 extension. The v16 Phase-10 candidate has been merged into `main` but is still not release-approved; see [candidate status](docs/RELEASE.md) and [README](README.md).

BTC Live v1.22.0 adds independently recovering Binance Futures WebSocket feeds, REST price fallback when the book request fails, and safer alert evaluation.

## Highlights

- Market trades/ticker and public book ticker each retry separately with bounded exponential backoff. A book connection failure cannot close the market stream, and vice versa.
- Market status remains reconnecting while market feed is down; book-only outages show degraded status instead of false full disconnection. Book quotes older than 8 seconds are flagged degraded.
- REST prices continue to load if the optional book-ticker request fails. Any previously validated book fields remain intact rather than being blanked.
- Stale/offline/reconnecting prices cannot trigger or rearm price-target or percent-move alerts.
- Target rearm hysteresis of 0.05% reduces immediate repetitive crossing alerts near a threshold.
- Background polling saves a minimal local timestamp/status diagnostic and rejects invalid price payloads. Checks still run approximately once per minute and can be delayed by Chromium.
- Ten focused Node.js regression tests plus an optional real-Chromium DOM/stream mock smoke test. Phase A renderer optimizations are retained.

## Verification

```bash
npm run release:check
python scripts/browser-smoke.py # optional, requires Playwright and Chromium
```

The Chromium smoke tests use an in-page, deterministic simulated WebSocket and DOM, not live Binance. Actual Manifest V3 service-worker activation, notifications across popup/dashboard/background, offline/online behavior and store screenshots remain manual release gates.

## Compatibility and packaging

- Manifest V3, Binance USDⓈ-M Futures endpoints, existing local settings, alert targets, storage keys and user configuration retained.
- Same `storage`, `notifications`, `alarms` permissions, Binance-only host permission, CSP and zero runtime npm dependencies.
- `btc-live-chromium-v1.22.0-store.zip` contains only the 36 runtime files from the allowlist.

BTC Live is independent and not affiliated with or endorsed by Binance.
