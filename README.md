# BTC Live

**BTCUSDT market terminal for Chromium (Manifest V3).** BTC Live displays public Binance USDⓈ-M Futures prices, trades and depth data, with charting, order-flow research, local recordings and optional notifications. No exchange credentials or order placement are involved.

> [!IMPORTANT]
> **Version and release status (2026-10-15):** `main` now contains the **v16 Phase 01-10 development candidate**, integrated through [PR #3](https://github.com/jsmlabs/btc-live/pull/3). The extension manifest intentionally remains **1.22.0**; this does **not** designate the v16 candidate as a stable or Chrome Web Store release. Chromium integration, live Binance feeds, MV3 lifecycle, multi-tab operation, migration and sustained-load acceptance still require documented evidence. The historical v1.22.0 release notes describe an earlier baseline, not the current `main` feature set. Automated verification of [main commit `a7920d2`](https://github.com/jsmlabs/btc-live/commit/a7920d2cc7b8277fb61280fedb74268cd71c2674) [passed in GitHub Actions](https://github.com/jsmlabs/btc-live/actions/runs/38689981950); live Chromium and exchange acceptance remain open.

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

## Install the source from `main` (development / test use)

1. Clone [the repository's `main` branch](https://github.com/jsmlabs/btc-live/tree/main) or download its source archive.
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

**Packaging:** `package:extension` now writes `dist/btc-live-chromium-v1.22.0-candidate.zip` with an explicit runtime-only allowlist, sorted files and fixed ZIP timestamps. The CI workflow is configured to check entry integrity, manifest, runtime-only paths, exclusions and matching SHA-256 hashes from two builds, then upload the candidate artifact. Successful execution must be confirmed from the corresponding Actions run. CI cancels superseded runs for the same ref; cancelled jobs do not count as passing tests. Packaging is **not** release approval.

| Command | Purpose | What it does **not** prove |
| --- | --- | --- |
| `npm run verify` | Source/manifest/reference validation and deterministic Node tests | Browser rendering or live exchange behavior |
| `npm run release:check` | Static release and packaging contract checks | Approval to publish v16 |
| `npm run package:extension` | Create deterministic candidate ZIP after verification | Store acceptance or runtime compatibility |

An isolated Phase-10 checkout previously reported **45 passing deterministic tests** (historical evidence). Current automated checks **passed** for [main commit `a7920d2`](https://github.com/jsmlabs/btc-live/actions/runs/38689981950), including ZIP validation and reproducibility; that does not establish live-browser or exchange acceptance. Review [Testing](docs/TESTING.md) and [Release readiness](docs/RELEASE.md) for the required gates.

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

Make focused, reversible changes and include regression tests for changed behavior. Preserve storage and manifest compatibility, constrained browser permissions, live/replay isolation, feed validity checks and notification de-duplication. Do not tag or distribute this candidate as a stable v16 release until the required manual acceptance evidence is recorded. Static verification alone does not certify live extension behavior.

[MIT license](LICENSE) · Independent project; not affiliated with or endorsed by Binance.
