# BTC Live

**BTCUSDT market terminal for Chromium (Manifest V3).** BTC Live displays public Binance USDⓈ-M Futures prices, trades and depth data, with charting, order-flow research, local recordings and optional notifications. No exchange credentials or order placement are involved.

> [!IMPORTANT]
> **Version and release status:** The extension manifest is **1.22.0**. This branch is a **v16 Phase 01-10 development candidate**, not a released v16 build. The candidate has not passed all browser, live-market, lifecycle and long-session acceptance gates. For the published/stable implementation, use [main](https://github.com/jsmlabs/btc-live/tree/main); for the integration discussion, see [PR #3](https://github.com/jsmlabs/btc-live/pull/3). Do not treat candidate features or screenshots as verified production behavior.

## What it does

| Workspace | Candidate capabilities | Limits |
| --- | --- | --- |
| Live | BTCUSDT price, trades, candles, order-book view and connection diagnostics | Binance connectivity, feed freshness and valid depth synchronization are required |
| Analytics | Rolling CVD, observed executed volume, divergence and book imbalance | Descriptive research metrics, not verified execution signals; missing data are not zero |
| Chart | Candle/line view, zoom/pan, drawings, crosshair and undo/redo | Actual Chromium pointer/keyboard behavior remains an acceptance item |
| Replay | Locally recorded session playback, steps, timeline and session comparison | Coverage may be incomplete; bookmarks are session-local |
| Alerts | Price alerts and dashboard-only advanced price/flow rules | Background checks are sampled; dashboard-only rules stop evaluating when it closes |
| Diagnostics | Connection state, feed age, bounded counters and runtime inspection | Telemetry does not establish live-feed correctness or performance gains |
| Layout | Presets, density controls, focus mode and command palette | Presets are not a free-form drag-and-drop layout system |

BTC Live does **not** submit trades, require Binance API keys, guarantee notifications, or predict market direction.

## Install the development candidate

1. Clone this branch (or download its source archive).
2. Open `chrome://extensions` in a supported Chromium browser and enable **Developer mode**.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Open the BTC Live toolbar popup, then **Open Dashboard**.
5. Confirm Binance access, data freshness and notification permissions before testing alerts.

Use a separate browser profile if a previously installed version holds data you need to preserve. Migration and upgrade compatibility have **not** been fully browser-tested.

## Develop, verify, package

Node.js **20 or newer** is declared by this candidate; the repository CI tests on **Node.js 22**. The source has no external runtime npm dependencies.

```bash
npm run verify
npm run release:check
npm run package:extension
```

**Packaging:** `package:extension` now writes `dist/btc-live-chromium-v1.22.0-candidate.zip` with sorted files and fixed ZIP timestamps. CI independently checks entry integrity, manifest and exclusions and uploads the candidate artifact. Packaging is **not** release approval.

| Command | Purpose | What it does **not** prove |
| --- | --- | --- |
| `npm run verify` | Source/manifest/reference validation and deterministic Node tests | Browser rendering or live exchange behavior |
| `npm run release:check` | Static release and packaging contract checks | Approval to publish v16 |
| `npm run package:extension` | Create deterministic candidate ZIP after verification | Store acceptance or runtime compatibility |

The candidate Phase-10 environment previously reported **45 deterministic passing tests**. This is historical candidate evidence, **not** a claim that the integrated branch or current CI has passed. Review [Testing](docs/TESTING.md) and [Release readiness](docs/RELEASE.md) for the required gates.

## System boundaries

```text
Public Binance REST / WebSocket
  -> market/ transport, validation, feed health and aggregation
  -> app/ runtime and bounded live alert evaluation
  -> ui/ selectors and rendering
  -> dashboard/ and popup/

background/ service worker -> sampled price alert checks
storage/ -> local settings, histories and recorded sessions
```

Depth continuity and snapshot synchronization must be valid before showing dependent analytics. Replay must not generate live notifications. Notification attempts are not reliable trade-execution events. See [Architecture](docs/ARCHITECTURE.md) and [Alerts](docs/ALERTS.md).

## Privacy and risks

The extension uses public market endpoints, local browser storage, notifications and alarms. It requests Binance REST host access and a restricted Binance streaming CSP. It has no order-execution functionality. Browser suspension, denied notifications, feed gaps and disconnected dashboards can prevent alerts; never use an alert as the sole risk control. See [Privacy](docs/PRIVACY.md).

## Documentation

| Guide | Subject |
| --- | --- |
| [Usage](docs/USAGE.md) | Install, controls, research, replay and troubleshooting |
| [Architecture](docs/ARCHITECTURE.md) | Runtime, trust boundaries and data validity |
| [Alerts](docs/ALERTS.md) | Evaluation, delivery and failure semantics |
| [Testing](docs/TESTING.md) | Deterministic checks, manual tests and evidence |
| [Release](docs/RELEASE.md) | Version policy, blockers and acceptance gates |
| [Privacy](docs/PRIVACY.md) | Permissions, endpoints and local information |
| [Phase 10](docs/PHASE10.md) | Development-stage engineering evidence |
| [Stable release notes](GITHUB_RELEASE.md) | Historical v1.22.0 release information |

## Contributing

Make focused, reversible changes and include regression tests for changed behavior. Preserve storage and manifest compatibility, constrained browser permissions, live/replay isolation, feed validity checks and notification de-duplication. Submit the candidate only after the required manual acceptance evidence is recorded. Static verification alone does not certify live extension behavior.

[MIT license](LICENSE) · Independent project; not affiliated with or endorsed by Binance.
