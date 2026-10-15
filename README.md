<p align="center">
  <img src="icons/icon128.png" alt="BTC Live icon" width="96" height="96">
</p>

<h1 align="center">BTC Live</h1>

<p align="center">
  <strong>A local-first Bitcoin market terminal for Chromium.</strong><br>
  Live BTCUSDT Futures data, charting, order-flow research, recording, replay and alerts.<br>
  <sub>Public market data · No Binance API keys · No trading or order submission</sub>
</p>

<p align="center">
  <a href="https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml"><img alt="Automated source checks" src="https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml/badge.svg?branch=main"></a>
  <img alt="Release: development candidate" src="https://img.shields.io/badge/release-development%20candidate-F3A23A?style=flat-square">
  <img alt="Manifest version: 1.22.0" src="https://img.shields.io/badge/manifest-1.22.0-30343B?style=flat-square">
  <img alt="Chromium Manifest V3" src="https://img.shields.io/badge/Chromium-Manifest%20V3-30343B?style=flat-square">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-30343B?style=flat-square"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#explore-the-terminal">Features</a> ·
  <a href="#development-and-verification">Verification</a> ·
  <a href="#documentation">Docs</a> ·
  <a href="docs/RELEASE.md">Release readiness</a>
</p>

> [!IMPORTANT]
> **Development candidate, not a stable v16 release.** The `main` branch contains the v16 Phase 01–10 candidate, but `manifest.json` still reports **1.22.0**. The existing v1.22.0 release documentation does **not** certify the v16 candidate. Automated source and packaging checks have passed on `main`; real Chromium, live Binance feeds, MV3 lifecycle, existing-install migration and sustained-load acceptance remain open. See the [release gates](docs/RELEASE.md). The CI badge reflects automated checks only, **not** production readiness.

---

## At a glance

| | |
| :-- | :-- |
| **Market** | BTCUSDT · Binance USDⓈ-M Futures |
| **Platform** | Chromium browser extension · Manifest V3 |
| **Experience** | Toolbar popup + multi-workspace dashboard |
| **Data** | Public Binance REST and WebSocket feeds |
| **Persistence** | Local extension storage; IndexedDB for supported recordings |
| **Dependencies** | No runtime npm packages; no exchange credentials |
| **Distribution** | Load unpacked for development and testing |
| **Current status** | v16 development candidate · manifest `1.22.0` |

BTC Live turns public market observations into a focused research workspace. **It is a monitoring tool, not a trading platform, prediction service or automated execution system.**

## 🚀 Quick start

**For candidate testing, use a separate Chromium browser profile.** Existing-install upgrades and storage migration have not yet passed acceptance.

1. Clone the repository, or [download the `main` source archive](https://github.com/jsmlabs/btc-live/archive/refs/heads/main.zip):

   ```bash
   git clone https://github.com/jsmlabs/btc-live.git
   ```

2. Open `chrome://extensions` in a Chromium-based browser and turn on **Developer mode**.
3. Click **Load unpacked** and select the **`btc-live` repository folder** containing `manifest.json`.
4. Pin/open **BTC Live** from the browser toolbar and select **Open Dashboard**.
5. Check connection state, source freshness and notification permissions before using data or alerts.

**No build step or npm install is needed to load the unpacked source.** The generated candidate ZIP is for packaging verification; it is not an approved stable release.

[Read the usage guide →](docs/USAGE.md)

## 🧭 Explore the terminal

| Workspace | Capabilities | What to know |
| :-- | :-- | :-- |
| **Live + chart** | Price and 24-hour stats, trades, depth, candlestick/line/area views, drawing and navigation tools | Feed age, candle provenance and depth continuity matter |
| **Analytics** | Rolling CVD, executed volume, price/delta divergence and order-book imbalance | Descriptive research metrics, **not** validated trading signals |
| **Replay** | Locally recorded sessions, timeline scrubbing, stepping and session comparisons | Recording coverage varies; replay is isolated from live alerts |
| **Alerts** | Price/percentage-move alerts plus dashboard-only advanced price/flow rules | Browser scheduling, permissions and freshness limit detection/delivery |
| **Diagnostics** | Transport state, data freshness and runtime/feed inspection | Connected does not necessarily mean synchronized or valid |
| **Personalization** | Workspace presets, layout and density modes, chart focus and command palette | Presets change presentation, not market data |

### Chart and navigation

The Live workspace includes **1m, 5m, 15m, 30m, 1h and 4h** interval controls; candlestick, line and area views; crosshair, zoom/pan and drawing interactions; and undo/redo. Supported drawing interactions include optional **Alt** snapping to OHLC coordinates.

| Shortcut | Action |
| :-- | :-- |
| `Ctrl+K` / `Cmd+K` (where supported) | Open the command palette |
| `F` (outside editable fields) | Toggle chart focus |

Presentation controls include **Standard / Wide / Stacked** layouts and **Compact / Comfortable / Analysis** density options. Browser-specific pointer and keyboard behavior still requires real-Chromium acceptance.

### Order-flow research

CVD and executed-volume metrics are computed from **observed aggressive trades**; order-book imbalance uses displayed bid/ask depth. They cannot reveal hidden liquidity or prove absorption, spoofing or future direction. A missing, stale or invalid observation is **unavailable, not zero**.

### Alerts: two execution paths

| Type | Evaluated when | Limitation |
| :-- | :-- | :-- |
| **Price and percentage alerts** | Popup/dashboard activity and sampled MV3 background REST checks | Sampling may miss a move; browser suspension and notification denial can prevent delivery |
| **Advanced price/flow rules** | **Only while a live dashboard is open**, subject to feed validity | Supports price, CVD, executed volume and book imbalance; no continuous closed-dashboard evaluation |

Advanced rules apply bounded windows, cooldowns, hysteresis and de-duplication. They use *at-most-once notification attempts*, **not** guaranteed delivery. Historical replay never triggers live alerts. [Alert behavior and failure modes →](docs/ALERTS.md)

---

## Data integrity is part of the design

```text
Binance Futures REST + WebSocket
                │
                ▼
market/      Transport · validation · freshness · market state
                │
                ▼
app/         Runtime · state · validated alert evaluation
                │
                ▼
ui/          Chart · analytics · replay · rendering
                │
                ▼
dashboard/   Multi-workspace terminal
popup/       Compact market view

background/  MV3 worker · sampled price-alert checks
storage/     Settings · alert state · local recordings
```

The application tracks feed freshness and synchronizes order-book snapshots with depth updates before exposing dependent metrics. A live socket connection alone does not establish a valid book. Stale or inconsistent observations suppress affected analytics and alert evaluations rather than silently creating a valid-looking value.

[Architecture and trust boundaries →](docs/ARCHITECTURE.md)

## 🛠️ Development and verification

**Requirements:** Node.js **20+** and npm. GitHub Actions uses **Node.js 22**. Run these from the repository root:

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
```

| Command | Purpose |
| :-- | :-- |
| `npm run verify` | Static checks and deterministic Node test suite |
| `npm run docs:check` | Validate local Markdown links across the project documentation |
| `npm run release:check` | Validate static manifest and release contracts |
| `npm run package:extension` | Re-verify and produce a deterministic candidate ZIP |

The packaging command writes `dist/btc-live-chromium-v1.22.0-candidate.zip`. The archive uses an explicit runtime file allowlist, sorted entries and fixed timestamps. CI checks archive integrity and reproducibility across two builds, then uploads a **candidate artifact**.

**Verification boundary:** Passing Node tests, static release checks, packaging or GitHub Actions does **not** prove Chromium runtime behavior, access to live Binance feeds, alert delivery or release approval. Consult [the latest workflow results](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml) for evidence at the exact commit and [the testing matrix](docs/TESTING.md) for remaining manual acceptance.

## 🔐 Privacy and safety boundaries

- **No exchange credentials:** Public Futures endpoints only; BTC Live cannot place trades or submit orders.
- **Minimal declared access:** `storage`, `notifications`, `alarms` and `https://fapi.binance.com/*`; the extension CSP allows the corresponding Binance REST and Futures WebSocket endpoints.
- **Local state:** Preferences, rules and history use extension storage; supported recorded sessions use IndexedDB. Browser-profile access and exported files remain under the user's control.
- **No delivery guarantees:** Browser scheduling, network interruptions, missing trade/depth data, notification denial and worker suspension can affect what is observed or delivered.

> [!CAUTION]
> **Do not use BTC Live alerts as your only trading risk control.** Neither market-data availability nor a triggered rule guarantees notification delivery or a tradeable opportunity.

[Privacy details](docs/PRIVACY.md) · [Security policy](SECURITY.md) · [Release blockers](docs/RELEASE.md)

## Documentation

| Guide | Scope |
| :-- | :-- |
| [Getting started & usage](docs/USAGE.md) | Installation, workspaces, controls, troubleshooting |
| [Architecture](docs/ARCHITECTURE.md) | Runtime modules, market-data validation, trust boundaries |
| [Alert semantics](docs/ALERTS.md) | Background sampling, advanced rules, delivery limitations |
| [Testing](docs/TESTING.md) | Automated checks, browser acceptance and evidence requirements |
| [Release readiness](docs/RELEASE.md) | Candidate status, exact-commit evidence and blocking gates |
| [Privacy](docs/PRIVACY.md) | Browser permissions, endpoints and local data |
| [Security](SECURITY.md) | Threat model and vulnerability reporting |
| [Changelog](CHANGELOG.md) | Historical release development |
| [Historical v1.22.0 notes](GITHUB_RELEASE.md) | Prior release notes, **not** v16 approval |
| [Phase 10 notes](docs/PHASE10.md) | Candidate engineering and remaining acceptance |

## Contributing

Keep changes small, reviewable and covered by relevant regression checks. Preserve least-privilege browser permissions, verified feed boundaries, safe storage behavior, MV3 lifecycle constraints and separation of live alerts from replay. Follow the [test strategy](docs/TESTING.md) and verify the **exact proposed commit**. Do not treat a generated ZIP or a green CI badge as approval to publish a stable release.

---

<p align="center">
  <sub><a href="LICENSE">MIT licensed</a> · An independent project, <strong>not affiliated with or endorsed by Binance</strong>.</sub>
</p>
