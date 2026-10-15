# BTC Live user guide

> **Build scope:** This guide covers the v16 development candidate in `main` (manifest `1.22.0`). It is available for evaluation, **not yet approved for customer distribution**. The installed store version can differ.

## Install for evaluation

1. Clone [`main`](https://github.com/jsmlabs/btc-live/tree/main) or download the source archive, or obtain an exact-commit candidate ZIP from [GitHub Actions](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml).
2. If using a candidate ZIP, check its SHA-256 against `SHA256SUMS.txt` and extract it to a folder.
3. In a **separate Chromium test profile**, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Pin/open the **BTC Live** toolbar popup. Use the **Open dashboard** control for the full workspace.
5. Check connection and feed-age diagnostics before treating any value as current; grant notifications only if you intend to test alerts.

Loading unpacked source requires no Node.js, npm install, credentials or Binance account. An Internet connection to public Binance USDⓈ-M Futures endpoints is needed for live data.

## Workspaces

| View | Typical task | Limitation |
| --- | --- | --- |
| **Live** | Monitor BTCUSDT Futures price, 24-hour metrics and interactive chart | Displayed values can be stale or unavailable |
| **Analytics** | Study observed aggressive trades, executed volume, rolling CVD, divergences and displayed depth | Descriptive metrics, not independently validated trade signals |
| **Replay** | Record supported sessions, scrub/step, bookmark and compare recorded data | Coverage varies; replay never drives live alerts |
| **Alerts** | Configure price thresholds and, while dashboard is open, advanced flow rules | Delivery and closed-dashboard evaluation are not continuous |
| **Diagnostics** | Inspect connection, data sources and freshness | Open connection does not prove synchronized order book |
| **Settings** | Tune layout, display preferences and notification rules | Changes affect presentation, not market data |

### Chart controls

Choose **1m / 5m / 15m / 30m / 1h / 4h** and **Candles / Line / Area** in the Live chart. Use zoom, pan, crosshair and supported drawing tools. Drawings support selection and undo/redo; hold **Alt** for optional OHLC snapping during drawing/editing.

| Shortcut | Function |
| --- | --- |
| `Ctrl+K` / `Cmd+K` (where supported) | Open command palette |
| `F` (outside editable inputs) | Toggle chart focus |

Layout presets: **Standard, Wide, Stacked**. Density: **Compact, Comfortable, Analysis**. The workspace preset controls which sections are presented; it does not change exchange observations.

## Market-data meaning

The application reads **public Binance Futures** REST/WebSocket streams. Rolling cumulative volume delta (CVD) uses signed observed aggressive executions; book imbalance measures displayed resting bid/ask liquidity. Neither metric proves hidden liquidity, spoofing, actual liquidations or the direction of future prices.

Depth metrics require correctly synchronized snapshot and diff sequence. Price, 24h statistics, trades and candles have separate freshness checks. **Missing or invalid data must be treated as unavailable, not zero.**

## Alerts and recordings

- **Price/percentage alerts:** evaluated in supported foreground paths and sampled MV3 background checks; a fast price crossing can be missed between samples.
- **Advanced flow alerts:** require an open dashboard and validated **live** metrics. Replay is excluded. A trigger is persisted before a notification attempt, so browser or OS denial can lead to a missed alert.
- **Recordings:** retained locally via browser storage; any export contains data you are responsible for handling. Session bookmarks and supported comparison values may depend on the recording's coverage.

See [alert delivery and failure semantics](ALERTS.md), [data handling](PRIVACY.md) and [release acceptance](ACCEPTANCE.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No data | Binance Futures network access, online status, REST/WS errors and diagnostics |
| Price updates but depth is unavailable | Wait for valid snapshot/diff resynchronization |
| Chart is empty | Selected interval, candle availability and feed age |
| Alert not delivered | Notification permission, enabled rule, dashboard state, valid live data and background sampling |
| Replay values are missing | Recording coverage, import validation and selected session |
| Layout looks incorrect | Restore a supported workspace/layout/density preset |
| Upgrade causes unexpected settings | Stop using the existing profile for candidate tests; preserve a before/after snapshot and record a migration defect |

**Safety:** BTC Live does not trade, place orders, predict price or guarantee alert delivery. Do not use it as your sole trading risk control.

[README](../README.md) · [Support](../SUPPORT.md) · [Release status](RELEASE.md)
