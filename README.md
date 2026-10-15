# BTC Live

**BTC Live** is a local-first Chromium Manifest V3 extension for monitoring public **BTCUSDT Binance USDⓈ-M Futures** market data. It provides a compact popup, a full-page dashboard, live market context, charting and configurable local browser alerts. No exchange account or API key is required.

**Current repository version: 1.22.0** (from `manifest.json` and `package.json`). The separately supplied archive named `btc-live_v2.2(1).zip` also declares **1.22.0**, but contains additional code **not yet integrated into `main`**. The archive filename is not evidence of a 2.2.0 release. See [archive integration](ARCHIVE_INTEGRATION.md) for its candidate features and required validation.

## What is in `main`

| Area | Implemented behavior |
| --- | --- |
| Popup and dashboard | BTCUSDT price, 24-hour statistics, market health, dashboard controls and persistent display preferences |
| Market feeds | Public Futures REST and WebSocket data with separate market/book reconnect, freshness checks and degraded-book reporting |
| Chart | 1m, 5m and 15m candles or line, optional volume and market reference levels |
| Alerts | Opt-in percentage-move and configurable price-target notifications, cooldown, rearming and bounded local history |
| Background checks | Chromium MV3 alarms sample prices approximately once per minute when applicable; not continuous monitoring |
| Privacy | Local browser storage, Binance public data only, no project backend or account credentials |

**Not shipped on `main`:** the expanded depth/flow analytics and recording/replay workspace in the supplied archive. Do not use those features in store listings or release notes before integration and testing.

## Install from source

1. Obtain the repository source and keep its directory structure intact.
2. Open `chrome://extensions` (or the equivalent Chromium extension page).
3. Enable **Developer mode**, select **Load unpacked**, and choose the directory containing `manifest.json`.
4. Pin **BTC Live** for the popup. Use **Open Dashboard** for the larger workspace.

This is an unpacked development installation, not proof of Chrome Web Store publication.

## Development

Requires **Node.js 22 or later** for the repository tooling. The extension itself has **no runtime npm dependencies**.

```bash
npm run verify
npm run release:check
```

`npm run verify` runs repository static verification and Node.js tests. `npm run release:check` additionally packages the explicit store runtime allowlist into `dist/`. Review the output and run real-browser QA before release. Optional deterministic visual-work benchmark:

```bash
node scripts/benchmark-render.mjs --baseline
npm run bench:render
```

The benchmark measures synthetic DOM/SVG work counts, **not** Chromium frame rate or live latency; see [performance evidence](PERFORMANCE.md). Optional simulated Chromium smoke coverage is described in [QA](QA.md).

## Architecture and network surface

| Path | Responsibility |
| --- | --- |
| `popup/`, `dashboard/` | Extension popup and full-page UI |
| `app/` | Market runtime, chart lifecycle and alert coordination |
| `market/` | Binance REST/WS, validation, freshness and connection state |
| `ui/` | Chart, rendering and shared UI components |
| `storage/` | Preferences, alert targets/history and diagnostics |
| `background/` | MV3 sampled alert checks |
| `tests/`, `scripts/` | Regression tests, verification and store packaging |

The manifest grants `storage`, `notifications` and `alarms`, with a single host permission `https://fapi.binance.com/*`. Extension CSP permits connections to `https://fapi.binance.com` and `wss://fstream.binance.com`. No content scripts, browsing-history access, account access or trading actions are required. See [architecture](ARCHITECTURE.md), [security](SECURITY.md) and [privacy](PRIVACY.md).

## Data freshness and risk

Market quotes can be stale, interrupted or delayed by the exchange, connectivity or Chromium suspension. The order-book display is indicative top-of-book data, not a promise of execution. Browser alarms are opportunistic samples and cannot guarantee alerts while the browser is closed or suspended. BTC Live does not submit orders, track positions or provide investment advice.

## Documentation

- [Changelog](CHANGELOG.md) - released changes and historical record
- [Architecture](ARCHITECTURE.md) - modules, data flow and trust boundaries
- [Quality assurance](QA.md) - automated and manual verification scopes
- [Performance](PERFORMANCE.md) - reproducible synthetic benchmark
- [Security](SECURITY.md) · [Privacy](PRIVACY.md) · [Hardening](HARDENING.md)
- [Release checklist](RELEASE_CHECKLIST.md) · [Release notes](GITHUB_RELEASE.md)
- [Store listing](STORE_LISTING.md) · [Store assets](STORE_ASSETS.md)
- [Archive integration](ARCHIVE_INTEGRATION.md) - pending expanded-workspace candidate

## License and attribution

See [LICENSE](LICENSE). BTC Live is independent and is not affiliated with or endorsed by Binance.
