<div align="center">

<img src="icons/icon128.png" alt="BTC Live icon" width="88" height="88">

# BTC Live

**Bitcoin market monitoring, without the noise.**

A local-first Chromium extension for live **BTCUSDT Binance USDⓈ-M Futures** prices, charts, feed diagnostics and configurable browser alerts.

**[Features](#features) · [Installation](#installation) · [Development](#development) · [Architecture](#architecture) · [Documentation](#documentation)**

<sub>Manifest V3 · Version 1.22.0 · Public market data · No account or API key required</sub>

</div>

---

> [!IMPORTANT]
> **Repository status:** `main` contains **v1.22.0**. A separately supplied archive named `btc-live_v2.2(1).zip` also declares v1.22.0, but has additional, **not yet merged** depth, order-flow and recording/replay code. Those capabilities are **not shipped in this repository state**. See [Archive Integration](ARCHIVE_INTEGRATION.md). The filename is not evidence of a v2.2.0 release.

## Overview

BTC Live puts an at-a-glance market view in the toolbar and a fuller monitoring workspace in a dedicated dashboard. It reads public exchange data directly, keeps user preferences and alert configuration in browser storage, and does not place trades.

| Compact popup | Full dashboard |
| :--- | :--- |
| Current BTCUSDT Futures price, 24-hour change and market context | Live chart, 24-hour statistics, top-of-book context and feed health |
| Quick access to alerts, settings and the dashboard | Dedicated panels for alerts, diagnostics and display preferences |

## Features

| Capability | What's included in v1.22.0 |
| :--- | :--- |
| **Live market data** | Binance USDⓈ-M Futures aggregate-trade/ticker and top-of-book feeds, with REST fallback |
| **Connection resilience** | Separate market/book WebSocket recovery, freshness indicators and degraded-book reporting |
| **Charts** | 1m / 5m / 15m intervals, candlestick or line view, optional volume and reference levels |
| **Price alerts** | Opt-in percentage-move and multiple above/below target alerts, cooldowns, rearming and local history |
| **Background sampling** | Optional Chromium alarm-driven price checks when the required alert settings are enabled |
| **Local preferences** | Display/chart settings, alert configuration and bounded diagnostics in extension storage |
| **Read-only operation** | No trading, wallet access, private exchange endpoints or API keys |

**Alert limitations:** Background checks are sampled, approximately once per minute under normal browser scheduling; they are **not continuous tick-by-tick monitoring**. Chromium may delay or suspend alarms, and alerts are not guaranteed when the browser is closed or inactive. Stale or disconnected market prices must not produce fresh price alerts.

## Installation

**Load the unpacked extension (development installation):**

1. Clone or [download the repository](https://github.com/jsmlabs/btc-live/archive/refs/heads/main.zip) and extract it.
2. Open `chrome://extensions` in Chrome or the extensions management page in another compatible Chromium browser.
3. Enable **Developer mode** and select **Load unpacked**.
4. Select the **repository root** containing `manifest.json`.
5. Pin **BTC Live** to the toolbar; open the popup or select **Open Dashboard** for the larger workspace.

No build or `npm install` is needed for unpacked runtime usage. A source installation does not imply Chrome Web Store approval or publication.

## Development

**Prerequisite:** Node.js **22 or newer**. No runtime npm dependencies are required.

```bash
git clone https://github.com/jsmlabs/btc-live.git
cd btc-live
npm run verify
```

| Command | Purpose |
| :--- | :--- |
| `npm test` | Run Node.js regression tests |
| `npm run verify` | Run source/static verification and the test suite |
| `npm run build:store` | Copy allowlisted extension files into a clean `dist/` directory |
| `npm run release:check` | Verify and create a store-package directory |
| `npm run bench:render` | Run the optimized synthetic render-work benchmark |

The store build is written to `dist/btc-live-chromium-v1.22.0-store/`. The packaging script creates a **directory**, not a ZIP or a published store release. Refer to [QA](QA.md) and the [Release Checklist](RELEASE_CHECKLIST.md) before producing a distribution artifact.

Optional baseline comparison:

```bash
node scripts/benchmark-render.mjs --baseline
npm run bench:render
```

These measurements count synthetic rendering work, not real Chromium FPS, latency, CPU or battery usage. See [Performance](PERFORMANCE.md).

## Architecture

```text
popup/ & dashboard/  →  app/runtime.js
                           ├── market/   REST, WebSocket, validation, state
                           ├── ui/       chart and scheduled rendering
                           ├── storage/  preferences, targets, history
                           └── app/      notifications and chart lifecycle

background/service-worker.js  →  sampled alert checks
tests/ & scripts/              →  verification and packaging
```

Market payloads are external, untrusted input; validation and freshness checks precede state updates and alert evaluation. Rendering is coalesced separately from market ingestion and alert processing. See [Architecture](ARCHITECTURE.md) for module responsibilities and trust boundaries.

### Permissions and connections

| Surface | Declared access |
| :--- | :--- |
| Extension permissions | `storage`, `notifications`, `alarms` |
| REST host permission | `https://fapi.binance.com/*` |
| Allowed WebSocket connection | `wss://fstream.binance.com` |
| Browser/page access | No content scripts or browsing-history permission |
| Credentials | No Binance account, trading API key or wallet access |

The extension connects to Binance public market-data services; it does not send user information to a project-operated backend. Storage is local to the browser. See [Privacy](PRIVACY.md) and [Security](SECURITY.md).

## Reliability and data interpretation

- **Feed state matters.** A market price or order-book value can be stale, delayed or unavailable during disconnection, exchange interruption or browser suspension.
- **Top of book is not trade execution.** Displayed bid/ask quotes are indicative liquidity, not guaranteed fills, traded volume or liquidation events.
- **Notifications are conditional.** Permissions, user settings, freshness, cooldowns, rearm rules and browser scheduling affect alert delivery.
- **Read-only data is not a trading signal.** BTC Live does not manage positions, execute orders or provide investment advice.

## Documentation

| Guide | Scope |
| :--- | :--- |
| [Architecture](ARCHITECTURE.md) | Components, data flow and trust boundaries |
| [Changelog](CHANGELOG.md) | Version history and released changes |
| [Quality Assurance](QA.md) | Automated coverage and pending manual browser checks |
| [Performance](PERFORMANCE.md) | Reproducible synthetic benchmark and limitations |
| [Security](SECURITY.md) · [Privacy](PRIVACY.md) | Permissions, data handling and security invariants |
| [Hardening](HARDENING.md) | Historical hardening decisions |
| [Release Checklist](RELEASE_CHECKLIST.md) · [Release Notes](GITHUB_RELEASE.md) | Packaging and release gates |
| [Store Listing](STORE_LISTING.md) · [Store Assets](STORE_ASSETS.md) | Publication copy and visual asset requirements |
| [Archive Integration](ARCHIVE_INTEGRATION.md) | Unmerged candidate features and validation requirements |

## License and disclaimer

See [LICENSE](LICENSE) for license terms. BTC Live is an independent project and is **not affiliated with or endorsed by Binance**. Binance and related marks belong to their respective owners. Market data is supplied by third-party services and may be delayed or unavailable.
