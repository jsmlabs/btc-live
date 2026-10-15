# BTC Live

**A local-first BTCUSDT market terminal for Chromium.**

Live Binance USDⓈ-M Futures market data, charting, order-flow research, recordings, replay and alerts in a Manifest V3 extension. **No Binance API keys. No trading or order submission.**

[Get started](#get-started) · [Explore capabilities](#workspaces) · [Run checks](#development-and-verification) · [Documentation](#documentation) · [Release readiness](docs/RELEASE.md)

> [!IMPORTANT]
> **Development candidate — not a stable v16 release.** The `main` branch includes the **v16 Phase 01–10 candidate**, while `manifest.json` still declares **1.22.0**. Historical v1.22.0 release notes do not certify this candidate. Automated checks passed on [verified main commit `d511e91`](https://github.com/jsmlabs/btc-live/actions/runs/38690697919); real Chromium, Binance feed, MV3 lifecycle, migration and sustained-load acceptance remain open. See [release gates](docs/RELEASE.md).

## At a glance

| | |
| --- | --- |
| **Platform** | Chromium extension · Manifest V3 |
| **Market** | BTCUSDT · Binance USDⓈ-M Futures public feeds |
| **Deployment** | Unpacked source for development and testing |
| **Storage** | Local extension storage and IndexedDB for supported recordings |
| **Runtime npm dependencies** | None |
| **Release status** | v16 development candidate · manifest `1.22.0` |

## Workspaces

| Workspace | What you can explore | Important boundary |
| --- | --- | --- |
| **Live** | BTCUSDT price, trades, candles, order book and feed diagnostics | Feed freshness and depth synchronization determine validity |
| **Analytics** | Rolling CVD, executed volume, divergence and book imbalance | Research metrics, **not** verified trading signals |
| **Chart** | Candles/line view, drawing tools, zoom/pan, crosshair, undo/redo | Pointer and keyboard behavior still need Chromium acceptance |
| **Replay** | Local recorded sessions, timeline, stepping and comparisons | Captures may be incomplete; replay is not a live feed |
| **Alerts** | Price alerts and advanced dashboard-only price/flow rules | Background sampling and browser lifecycle can delay checks |
| **Diagnostics** | Connection state, feed age and runtime inspection | Connection alone does not establish data integrity |
| **Layout** | Presets, density, focus mode and command palette | Presets are not free-form drag-and-drop layouts |

> [!NOTE]
> BTC Live **does not** execute trades, predict price direction, guarantee alert delivery or require a Binance account. Treat delayed, missing or invalid market data as unavailable—not as zero.

## Get started

Use a separate browser profile for candidate testing, especially if you have an existing installation with stored data. Upgrade and migration compatibility are not yet fully validated.

1. Clone [the `main` source](https://github.com/jsmlabs/btc-live/tree/main) or download its source archive.
2. In Chromium, open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the repository folder containing `manifest.json`.
4. Open the **BTC Live** toolbar popup, then **Open Dashboard**.
5. Inspect connection state, feed freshness and browser notification permissions before using alerts.

**First-use guide:** [Controls, chart interactions and troubleshooting](docs/USAGE.md).

## Development and verification

**Prerequisite:** Node.js **20+**; GitHub Actions currently uses **Node.js 22**. No external runtime npm packages are required.

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
```

| Command | Checks or creates | Does not establish |
| --- | --- | --- |
| `npm run verify` | Static source validation and deterministic Node tests | Chromium behavior or real market feeds |
| `npm run docs:check` | Local Markdown links across README and documentation | External link availability |
| `npm run release:check` | Manifest and static release contracts | Production or store approval |
| `npm run package:extension` | Deterministic candidate ZIP under `dist/` | Runtime compatibility or stable-release readiness |

**Packaging:** the current command creates `dist/btc-live-chromium-v1.22.0-candidate.zip` with a runtime allowlist, sorted entries and fixed ZIP timestamps. CI checks ZIP integrity and two-build SHA-256 reproducibility, then uploads a candidate artifact. Consult the [latest GitHub Actions results](https://github.com/jsmlabs/btc-live/actions) for the exact commit; a cancelled or queued run is not a pass.

## How it fits together

```text
Binance public REST + WebSocket
        │
        ▼
market/      Transport · validation · freshness · aggregation
        │
        ▼
app/         Runtime · state · bounded alert evaluation
        │
        ▼
ui/          Selectors · rendering
        │
        ├── dashboard/
        └── popup/

background/  MV3 service worker · sampled price-alert checks
storage/     Preferences · alert state · locally recorded sessions
```

The extension must validate order-book continuity before producing dependent analytics. Live alerts use current validated state; historical replay must not trigger live notifications. Details: [Architecture](docs/ARCHITECTURE.md) · [Alert semantics](docs/ALERTS.md).

## Security, privacy and limitations

BTC Live uses public Binance endpoints, browser storage, notifications and alarms. It does not require exchange credentials or place orders. Locally recorded sessions and saved state remain subject to browser-profile access and user-managed exports.

Browser suspension, network failures, missed price moves and denied notifications may prevent alerts. **Never rely on an alert as the sole risk control.**

Read the [security policy](SECURITY.md), [privacy and data handling](docs/PRIVACY.md) and [release blockers](docs/RELEASE.md).

## Documentation

| Start here | Covers |
| --- | --- |
| [Usage guide](docs/USAGE.md) | Installation, navigation, interactions and troubleshooting |
| [Architecture](docs/ARCHITECTURE.md) | Components, trust boundaries and data validity |
| [Alerts](docs/ALERTS.md) | Rules, sampling, de-duplication and failure behavior |
| [Testing](docs/TESTING.md) | Automated verification and real-browser test plan |
| [Release readiness](docs/RELEASE.md) | Candidate status, evidence and blocking acceptance gates |
| [Privacy](docs/PRIVACY.md) | Permissions, connections and local data |
| [Security policy](SECURITY.md) | Security model and vulnerability reporting |
| [Changelog](CHANGELOG.md) | Historical releases and candidate distinction |
| [Historical release notes](GITHUB_RELEASE.md) | Previously documented v1.22.0 release |
| [Phase 10 engineering notes](docs/PHASE10.md) | Development-stage design and implementation evidence |

## Contributing

Prefer focused, reviewable changes with regression coverage. Preserve minimal browser permissions, validated market-data boundaries, storage compatibility, MV3 lifecycle constraints and separation of live alerts from replay. Use [testing instructions](docs/TESTING.md) and confirm CI on the **exact** commit before merging. A successful build is not authorization to publish a stable version.

---

[MIT License](LICENSE) · Independent project; **not affiliated with or endorsed by Binance**.
