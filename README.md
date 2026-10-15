<div align="center">

<img src="icons/icon128.png" width="88" height="88" alt="BTC Live logo">

# BTC Live

**A Bitcoin Futures market terminal, built for your browser.**

Live BTCUSDT market observation · Charts and order flow · Local replay · Configurable alerts

[![Verification](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml)
![Chromium](https://img.shields.io/badge/Chromium-Manifest_V3-30343B?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/manifest-1.24.2-F3A23A)
![Status](https://img.shields.io/badge/status-development_candidate-555)
[![License](https://img.shields.io/badge/license-MIT-30343B)](LICENSE)

[**Get started**](#get-started) · [**Explore workspaces**](#inside-the-terminal) · [**Architecture**](#architecture-at-a-glance) · [**Verification**](#build-and-verify) · [**Documentation**](#documentation)

</div>

> [!IMPORTANT]
> **Development candidate, not an approved customer release.** The current `main` branch declares version **1.24.2** in `manifest.json`. Automated checks do not establish live Chromium/MV3 behavior, real Binance connectivity, alert delivery, migration safety or Chrome Web Store approval. See [release acceptance](docs/ACCEPTANCE.md).

### Product snapshot

| Market | Experience | Privacy | Execution |
| :--- | :--- | :--- | :--- |
| Public Binance USDⓈ-M Futures **BTCUSDT** | Popup + **six** terminal workspaces | Local preferences and supported recordings; no exchange API key needed | **Read-only market monitoring**; no trade placement |

**Designed for observation, not execution.** The UI reports independent feed freshness and integrity states. Missing data is never proof of zero activity.

## What is BTC Live?

BTC Live brings public Binance **USDⓈ-M Futures BTCUSDT** market observations into a focused browser workspace. It is designed for **monitoring and research**, without requiring a Binance account, API keys, wallet connection or developer-operated data backend.

| | |
| :-- | :-- |
| **Platform** | Chromium extension · Manifest V3 |
| **Market** | BTCUSDT perpetual Futures data from public Binance endpoints |
| **Views** | Toolbar popup and six dashboard workspaces |
| **Market feeds** | HTTPS REST + WebSocket; independent freshness and validation |
| **On-device state** | Extension storage and IndexedDB for supported recordings |
| **Runtime dependencies** | No npm packages or remote executable code |
| **Trading** | **No exchange-account access and no order execution** |

## Get started

**No build step is required to load the source as an unpacked extension.** Use a **separate browser profile** for candidate evaluation. Migration from an existing installed version is not yet accepted.

1. Clone the current source:

   ```bash
   git clone https://github.com/jsmlabs/btc-live.git
   cd btc-live
   ```

2. Open `chrome://extensions` in Chromium, switch on **Developer mode** and select **Load unpacked**.
3. Select the cloned directory containing `manifest.json`.
4. Open BTC Live from the toolbar, then use **Open market terminal** for the full terminal.
5. Confirm feed connectivity, freshness and notification permissions before interpreting data or testing alerts.

There is **no install/build requirement** for loading unpacked source. For a verified CI package instead, download the **`btc-live-candidate-zip` artifact** from [GitHub Actions](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml), verify the included `SHA256SUMS.txt`, extract the inner extension ZIP and load the extracted directory. **Do not submit that candidate ZIP to the store as a stable release.**

[Full installation and user guide →](docs/USAGE.md)

## Inside the terminal

The six workspaces separate live observation, research, alerts and operational controls. Not all views or actions are available in every workspace preset.

| Workspace | Designed for | Important boundary |
| :-- | :-- | :-- |
| **Live** | Price, 24-hour statistics, candles, depth, drawing tools and chart overlays | Feed freshness and candle provenance remain visible |
| **Analytics** | Aggressive trade volume, rolling CVD, price/delta comparisons and displayed depth | Descriptive observations, **not** proven signals |
| **Replay** | Supported local recordings, step/seek, temporary bookmarks and comparisons | Recorded events cannot trigger live alerts |
| **Alerts** | Price/percentage targets and advanced price/flow rules | Advanced rules need an **open live dashboard** |
| **Diagnostics** | Transport recovery, freshness, data-source and runtime state | Connected socket ≠ synchronized market data |
| **Settings** | Presentation, preferences and notification controls | Settings do not change exchange facts |

### Charts and navigation

- **Intervals:** 1m · 5m · 15m · 30m · 1h · 4h.
- **Styles:** Candlestick · Line · Area; chart drawing, pan/zoom, crosshair and overlays.
- **Chart workspace:** Expand the chart into a native modal; reference prices are available in an inline disclosure.
- **Layout:** Standard · Wide · Stacked; density: Compact · Comfortable · Analysis.
- **Navigation:** Desktop sidebar, scrollable tablet bar and a two-row phone navigation with all six workspaces visible. Use arrow keys, Home and End within navigation.
- **View options:** Workspace preset, dashboard density and panel layout are grouped in one menu. Dashboard density stays selected during market updates.
- **Workspaces:** Simple, Advanced and Custom presets; available views and command-palette entries depend on the preset. Analytics has focused Liquidity / Order flow / Behavior views.
- **Replay:** Numbered capture, local session and inspection steps; recording limits remain in an inline disclosure.
- **Settings:** Keyboard reference and explicit reset scope for display and notification defaults.
- **Shortcuts:** `Ctrl+K` / `Cmd+K` where supported opens the command palette; `F` toggles focus mode outside text fields; `Escape` exits focus or an expanded chart. Hold `Alt` for optional OHLC drawing snap.

### How to interpret market data

CVD and executed volume are calculated from **observed aggressive trades**. Book imbalance is derived from visible resting bid/ask liquidity; it does not establish hidden liquidity, spoofing, liquidation events or future price direction. Incomplete or stale input is **unavailable, not zero**.

The order book must pass snapshot/diff synchronization before dependent analytics are valid. Price, ticker, trade, depth and candle streams have separate integrity and freshness boundaries.

### Alerts are not guaranteed delivery

| Path | When evaluated | Why a trigger may be missed |
| :-- | :-- | :-- |
| Standard price/percentage alerts | Supported foreground paths + sampled background MV3 checks | Sampling intervals, worker suspension, stale feeds or permissions |
| Advanced price/CVD/volume/imbalance rules | **Only while a live dashboard is open** | Feed validity, cooldowns, Web Locks, dashboard closure or notification denial |

Advanced rules are designed around **at-most-once notification attempts**, not exactly-once delivery. Replay never triggers live alerts. [Read the full alert contract →](docs/ALERTS.md)

## Architecture at a glance

```mermaid
flowchart TD
    B["Public Binance Futures REST + WebSocket"] --> M["market/ · Validation, synchronization & state"]
    M --> A["app/ · Runtime and alert orchestration"]
    A --> U["ui/ · Charts, order flow, liquidity & replay"]
    U --> P["popup/ · Toolbar experience"]
    U --> D["dashboard/ · Six workspaces"]
    S["storage/ · Preferences and local recordings"] <--> A
    W["background/ · MV3 sampled price checks"] --> S
    classDef source fill:#30343B,stroke:#F3A23A,color:#F4F6F8
    class B source
```

The data pipeline is observation-only. Data validation, feed synchronization, browser lifecycle and notification permissions determine which views and alerts are actionable.

The runtime is self-contained and uses no remote executable JavaScript. The manifest requests `storage`, `notifications`, `alarms` and host access to `https://fapi.binance.com/*`; its CSP permits public Futures WebSocket connectivity to `wss://fstream.binance.com`. [Technical architecture →](docs/ARCHITECTURE.md)

## Build and verify

Automated checks cover source and packaging contracts; they do **not** replace hands-on browser acceptance or real exchange-feed testing.

**Node.js 20+** and npm are needed for developer checks; GitHub Actions runs with Node.js 22.

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
```

| Output | Meaning |
| :-- | :-- |
| `dist/btc-live-chromium-v1.24.2-candidate.zip` | Reproducible Chromium candidate package |
| `dist/SHA256SUMS.txt` | Artifact checksum |
| `dist/BUILD_INFO.json` | Candidate status, version, source commit and artifact metadata |
| [CI workflow](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml) | Automated syntax/tests, documentation/release checks, archive integrity and reproducibility |

`npm run release:gate` **intentionally fails** while required real-world release evidence is missing. Final acceptance uses a separate, commit-bound approval file, not the committed pending template. A green CI badge confirms automation only.

## Software updates

BTC Live checks the official GitHub Releases API for eligible newer versions on startup and at most daily during normal use. The popup main view shows a discreet indicator when a newer release is available. Popup Settings and dashboard Settings contain **Software Updates**, with the installed version, available version, channel, check status and a manual check. Stable excludes drafts and pre-releases; Preview additionally permits explicitly published prereleases. Release lookups validate a bounded, paginated history; incomplete histories or malformed API responses are treated as check failures rather than definitive absence of an eligible release. A Git commit, tag or CI development-candidate ZIP alone is not a public update. An installed unpacked extension may therefore display an older version than the latest repository source until its local files are refreshed and the extension is reloaded. The panel distinguishes last successful check from last attempt and rejects stale results from a different installed version. When no qualifying release exists, the status is **No eligible published release**, not Up to date. Checks use the public GitHub API without authentication; the extension requests `https://api.github.com/*` and permits that origin in its connect-src CSP. GitHub rate limits and network failures are nonfatal; transient failures are retried no sooner than 15 minutes unless manually requested, and the previous result can be stale. The feature opens official release notes only; it never installs software or executes remote code. Browser-store installations continue updating through the store.

## Privacy, safety and release scope

BTC Live is a monitoring interface, **not** a trading platform, signal service or substitute for order risk controls. Market-data gaps, browser lifecycle and failed notifications can prevent timely observations. Preferences and supported recordings are stored locally, but browser profile access and exported copies require appropriate care.

> [!CAUTION]
> **Do not rely on BTC Live notifications as your sole trading risk management mechanism.** No price, liquidity, signal, execution or alert-delivery guarantee is implied.

A stable release requires recorded acceptance of actual Chromium UI, live Binance feeds and recovery, multi-tab/MV3 alerts, recording/replay load, existing-install migration and store/privacy assets. No stable version, tag or store publication is claimed.

## Documentation

Start with the [complete documentation index](docs/INDEX.md) for task-specific guides and release evidence.

| Audience | Guide |
| :-- | :-- |
| End users and testers | [Installation, navigation and troubleshooting](docs/USAGE.md) |
| Technical readers | [Architecture & trust boundaries](docs/ARCHITECTURE.md) · [Alert semantics](docs/ALERTS.md) |
| Contributors | [Contributing](CONTRIBUTING.md) · [Repository workflow](docs/REPOSITORY.md) |
| QA and release | [Testing](docs/TESTING.md) · [Acceptance matrix](docs/ACCEPTANCE.md) · [Release readiness](docs/RELEASE.md) |
| Privacy and security | [Privacy policy](PRIVACY.md) · [Security policy](SECURITY.md) |
| Distribution | [Store listing draft](STORE_LISTING.md) · [Store asset policy](STORE_ASSETS.md) |
| Support and navigation | [Support](SUPPORT.md) · [Documentation index](docs/INDEX.md) |

---

<p align="center"><sub>MIT licensed · Independently developed · Not affiliated with or endorsed by Binance.</sub></p>

