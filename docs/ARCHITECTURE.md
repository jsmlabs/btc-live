# Architecture and trust boundaries

**Current implementation:** Chromium Manifest V3 candidate, `main`, manifest `1.25.5`. This describes the repository source; browser and live-feed acceptance are separate [release gates](ACCEPTANCE.md).

## Components

```text
Binance USDⓈ-M Futures (untrusted public REST + WebSocket)
                              |
market/   Transport adapters, validators, market state, feed health
                              |
app/      Runtime lifecycle, chart input, notifications, rule evaluation
                              |
ui/       Charts and overlays, flow analytics, replay, rendering
                          /        \
popup/    Compact market view    dashboard/ Six-workspace terminal

background/     MV3 service worker; scheduled, sampled price checks
storage/        Local preferences, alert rules/history, replay sessions
utils/          Shared formatting, time and backoff primitives
```

| Path | Responsibility | Critical invariant |
| --- | --- | --- |
| `market/binance-rest.js`, `binance-websocket.js`, `binance-klines.js` | Public market access | Validate external payloads and independently handle failure |
| `market/binance-depth.js` | REST snapshot + incremental depth | Update IDs and continuity before exposing a valid book |
| `market/binance-aggtrades.js` | Aggressive trade stream | Segment, deduplicate and invalidate stale observations |
| `market/market-state.js`, `validators.js` | Price/ticker/book state | Reject malformed/stale input, preserve source attribution |
| `app/runtime.js`, `chart-runtime.js` | Lifecycle and chart data | Do not fabricate candles from trade/ticker observations |
| `app/notifications.js`, `advanced-alert-engine.js` | Rule semantics | Valid live data, cooldowns, controlled notification attempts |
| `ui/theme.css`, `dashboard/workspace.css`, `popup/experience.css` | Shared palette and responsive presentation | No data transformations, external fonts or remote assets |
| `ui/analytics-views.js` | Focused Analytics context, keyboard selection and redraw scheduling | Filtering does not change feed subscriptions or metric definitions |
| `ui/workspace.js`, `terminal-experience.js`, `disclosure-menus.js` | Workspace navigation, command palette and menu dismissal | Presentation preferences cannot bypass workspace presets or alter feed/alert state |
| `ui/chart-expansion.js`, `notification-test.js` | Native chart modal and explicit notification-test feedback | Move the existing chart DOM without rebuilding its state; API acceptance is not delivery proof |
| `ui/chart.js`, `render-scheduler.js` | Graphical display | Coalesce paint without delaying market state/alerts; ignore stale cancelled frame callbacks, support independent per-SVG redraw subscriptions and positive finite live/24h price references |
| `ui/event-replay.js`, `market-recorder.js` | Recorded-session playback | Replay must not mutate live market state or fire alerts |
| `storage/replay-sessions.js` | IndexedDB session retention | Validate schemas/size and handle storage failure |
| `background/service-worker.js` | MV3 sampled price checks | Suspension/alarms cannot promise continuous observation |

## Data validity is a prerequisite

**Price, ticker, depth, aggressive trades and exchange-origin klines are separate streams.** A connected WebSocket alone does not demonstrate freshness, source consistency or book validity. Binance frames and REST responses must be validated for symbols, finite amounts, timestamp order and applicable sequencing. A missing observation is *unavailable*, not zero.

The order book is only valid after snapshot/diff synchronization; a gap or crossed/invalid candidate must not corrupt the last accepted state. Candidate diff checks inspect only updated levels and the current book before committing changes, avoiding whole-book copies while preserving transactional rejection. Aggressive trade counts are observed execution prints; book levels represent resting displayed liquidity. Derived measures are descriptive and do not reveal hidden orders or guarantee forecast quality.

## Trust and privilege boundaries

- **Network:** Host permissions are scoped to `https://fapi.binance.com/*` for market data and `https://api.github.com/*` for release discovery; the extension CSP permits those HTTPS origins and `wss://fstream.binance.com`. Data from those endpoints is untrusted.
- **Extension:** MV3 with `storage`, `notifications`, `alarms`. No page content scripts, remote executable code, wallet access or order submission.
- **Persistence:** Browser extension storage and IndexedDB can contain settings, rules, diagnostics and recorded observations. Malformed imported records and storage errors require safe handling.
- **Alerts:** Standard background checks are sampled. Advanced rules evaluate only in a live dashboard; Web Locks coordinate cooperating tabs. State is claimed before notification attempts, so delivery can be lost without being retried. Replay is isolated.
- **Rendering:** Diagnostic and research labels must distinguish stale/invalid state; visual status cannot itself authorize a state transition.

## Verification boundary

Static checks, Node test fixtures and the optional mocked browser smoke harness cannot substitute for a real unpacked extension, live Binance recovery tests, MV3 suspension, notification denial, long load or migration verification.

[Source testing](TESTING.md) · [Alert contract](ALERTS.md) · [Privacy](PRIVACY.md) · [Release gates](RELEASE.md)


## GitHub software update discovery

`app/software-updates.js` validates public GitHub Releases metadata and compares semantic versions with the installed `runtime.getManifest().version`. Only a published, non-draft GitHub Release whose prerelease flag matches its tag semantics is eligible. No release is distinct from Up to date. The background MV3 worker coordinates message requests and a daily browser alarm; view instances do not poll. Release lookups traverse up to five 100-item API pages and fail closed if pagination cannot be completed, preventing false no-release results; update checks and preference writes are serialized in that worker to prevent cross-view storage races; persisted results are accepted only for their checked installed version, and UI storage notifications are sanitized before links are displayed. Storage is isolated under `btcLiveSoftwareUpdates` and contains check state, timestamps, channel and preferences, not account identifiers. Remote release notes are never injected into DOM HTML. Navigation is limited to a synthesized URL under the official repository. `https://api.github.com/*` is the only additional host permission and `https://api.github.com` is added to connect-src. GitHub checks cannot alter market data, chart, alert, replay or execution state.

The extension can discover a release, but it cannot safely self-install it or establish the authenticity of an arbitrary attached ZIP. A stable release remains blocked by the separate manual acceptance gates.
