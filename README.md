# BTC Live

A privacy-conscious Chromium Manifest V3 terminal for **BTCUSDT** using public Binance USDⓈ-M Futures market data. It includes price and depth monitoring, order-flow analytics, chart tools, event replay, and opt-in alerts.

> **Release status: v16 development candidate (not production approved).** The packaged extension still declares `1.22.0` in `manifest.json` to avoid presenting an unverified v16 release. Chromium UI, live feed, MV3 lifecycle, multi-tab concurrency and long-running performance acceptance tests remain open. The GitHub branch contains candidate source code, not a released v16 store build.

## Capabilities

| Area | Available features | Scope / limitations |
| --- | --- | --- |
| Market data | Public BTCUSDT Futures ticker, trades, candles, order book, reconnect diagnostics | Requires Binance public endpoints; feed quality can degrade |
| Order flow | CVD windows (10/30/60/300 seconds), price/delta divergence, book-imbalance and liquidity persistence | Descriptive metrics, **not** verified trade signals; gaps invalidate affected observations |
| Chart | Candlestick/line, drawing tools, crosshair, pan/zoom, optional OHLC snapping, undo/redo | Interactive browser behavior requires manual verification |
| Workspace | Live, Analytics, Replay, Alerts, Diagnostics, Settings; density/layout presets, focus mode and command palette | Layouts are presets, not a drag-and-drop grid |
| Replay | Recorded-session playback, stepping, timeline, in-memory bookmarks and session comparison | Bookmarks are not persistent; recorded coverage may be incomplete |
| Alerts | Existing price/background alerts and advanced dashboard rules for price, CVD, executed volume and imbalance | Advanced rules **require an active dashboard**; closed-dashboard continuous monitoring is not supported |
| Diagnostics | Feed states, bounded telemetry and render-scheduler counters | Telemetry counters are not proof of improved FPS |

BTC Live uses no exchange API keys, performs no order execution and does not claim predictive accuracy or trading profitability.

## Install for development

1. Download or clone this **candidate branch**.
2. Open `chrome://extensions` (or the equivalent Chromium extensions page).
3. Enable **Developer mode**, select **Load unpacked**, and choose the repository root containing `manifest.json`.
4. Open **BTC Live** from the extension toolbar, then **Open Dashboard**.
5. Validate connections, market-data status and notification permissions before relying on alerts.

Use a dedicated test browser profile when comparing with an already installed version. Storage compatibility and live update behavior have not been completely browser-verified.

## Verify and package

Node.js 22 or later recommended. There are no external npm runtime dependencies.

```bash
npm run verify
npm run release:check
npm run package:extension
```

`verify` runs static integrity checks and deterministic Node tests. `release:check` inspects release contracts; it is **not** a browser/live-certification command. Packaging excludes development-only material. See [Testing and release gates](docs/TESTING.md) and [Release status](docs/RELEASE.md).

## Architecture

- `market/`: REST/WebSocket transports, feed validation, aggregation and market state.
- `app/`: shared runtime, background-price-alert logic and advanced live-alert engine.
- `ui/`: charts, order flow, liquidity, confluence, playback and render scheduling.
- `storage/`: local preferences, alerts, recordings and diagnostics.
- `dashboard/`, `popup/`, `background/`: UI surfaces and the MV3 service worker.
- `tests/`, `scripts/`, `.github/workflows/`: deterministic tests, static checks and CI.

Detailed boundaries and failure behavior: [Architecture](docs/ARCHITECTURE.md).

## Privacy, safety and data quality

Public Binance market data is used, without account credentials. The extension has `storage`, `notifications` and `alarms` permissions and a Binance Futures host permission. Recordings and settings may be stored locally. Advanced alerts may miss events if the dashboard closes, the feed disconnects or the browser suspends execution. Depth-based analytics are withheld when a sequence gap is detected. See [Privacy and permissions](docs/PRIVACY.md) and [Alert semantics](docs/ALERTS.md).

## Documentation

- [Getting started and controls](docs/USAGE.md)
- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Alerts and delivery guarantees](docs/ALERTS.md)
- [Testing, verification and smoke checks](docs/TESTING.md)
- [Release readiness and open blockers](docs/RELEASE.md)
- [Privacy](docs/PRIVACY.md)
- [Phase 01-10 engineering records](docs/PHASE10.md)

## Contributing

Prefer small, reversible changes. Preserve manifest/storage contracts, least-privilege permissions and live-versus-replay isolation. Include deterministic regression fixtures for feed and alert behavior, and do not represent static test results as browser/live evidence. See [Testing](docs/TESTING.md).

License: see [`LICENSE`](LICENSE) in the upstream repository.
