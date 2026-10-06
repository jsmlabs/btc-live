# BTC Live

BTC Live is a lightweight Chromium Manifest V3 extension for monitoring BTCUSDT Spot market data from Binance with a compact popup, a full dashboard, a live chart, and persistent browser alerts.

## Current release: v1.13.0

### Highlights

- Live BTCUSDT last-trade price from Binance Spot WebSocket streams
- Rolling 24h change, open, high, low, quote volume, bid, ask, spread, and range position
- Explicit `LIVE`, `DEGRADED`, `STALE`, `RECONNECTING`, and `OFFLINE` states
- Shared popup/dashboard runtime with deterministic reconnect and freshness handling
- Lightweight BTCUSDT chart with 1m, 5m, and 15m intervals, candle/line modes, volume, and reference levels
- Native Chromium notifications for price moves and connection state changes
- Persistent background alerts through an MV3 service worker and `chrome.alarms`
- Multi-target `Above` / `Below` BTC price alert manager with labels, enable/disable controls, re-arming, and migration from v1.12.0 single targets
- Local alert history for sent, suppressed, and failed events, capped at 100 entries
- Local-only settings and diagnostics
- Zero runtime package dependencies
- No account, API key, analytics, tracking, advertising, or custom backend

## Architecture

BTC Live separates market data, state, alerting, storage, rendering, and background scheduling into small ES modules.

```text
app/         shared runtime, chart runtime, notifications, background alert controller
background/  Manifest V3 service worker
market/      Binance REST/WebSocket clients, validation, connection and market state
storage/     settings, chart preferences, diagnostics, alert targets, alert history
ui/          popup/dashboard rendering, chart rendering, alert center
popup/       compact toolbar popup
dashboard/   full-page monitoring dashboard
utils/       formatting, timing, deterministic backoff
tests/       Node.js regression suite
scripts/     verification and explicit store packaging
```

Market-data responsibilities:

- `btcusdt@trade`: authoritative last-trade updates
- `btcusdt@ticker`: rolling 24h statistics and book context
- `GET /api/v3/ticker/24hr?symbol=BTCUSDT`: initialization, recovery, and background alert checks
- Binance Spot klines: chart initialization and periodic reconciliation

External payloads are validated before they can update application state.

## Permissions

BTC Live requests exactly these extension permissions:

- `storage`: persist local settings, alert targets/history, chart preferences, and session diagnostics
- `notifications`: display native Chromium notifications
- `alarms`: schedule persistent background alert checks

Host permission:

- `https://api.binance.com/*`: Binance public Spot REST market data

The extension has no content scripts and does not request access to browsing history, page contents, cookies, bookmarks, downloads, tabs, wallets, exchange accounts, or credentials.

## Development

Requirements:

- Node.js 20 or newer
- A Chromium-based desktop browser for manual extension testing

Run deterministic verification:

```bash
npm run verify
```

Run the full release check and build a clean store directory:

```bash
npm run release:check
```

The store build is written to:

```text
dist/btc-live-chromium-v1.13.0-store/
```

The release pipeline currently verifies 96 deterministic tests plus manifest, DOM, import, permission, CSP, icon, and explicit runtime-allowlist invariants.

## Load unpacked

1. Run `npm run release:check`.
2. Open `chrome://extensions` or the equivalent Chromium extensions page.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `dist/btc-live-chromium-v1.13.0-store`.

For development, the repository root can also be loaded directly because development-only files are not referenced by the manifest.

## Privacy

BTC Live does not collect or transmit personal user data to project infrastructure. It has no backend. Local extension state stays in browser extension storage. Network traffic is limited to disclosed Binance public market-data endpoints required for the extension's market-monitoring features.

See [PRIVACY.md](PRIVACY.md).

## Security

- Manifest V3
- HTTPS/WSS only
- No remote executable JavaScript
- No `eval()` or equivalent dynamic execution
- No inline scripts or inline event handlers
- No content scripts
- No API keys or secrets
- Strict external-data validation
- Explicit fail-closed store runtime allowlist
- Zero runtime dependencies

See [SECURITY.md](SECURITY.md) and [HARDENING.md](HARDENING.md).

## Quality assurance

See [QA.md](QA.md) for the manual regression checklist.

## Market-data attribution

Market data is provided by Binance public Spot market-data services. BTC Live is an independent project and is not affiliated with or endorsed by Binance.

## License

MIT. See [LICENSE](LICENSE).
