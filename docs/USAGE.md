# User guide

**Applies to:** the `main` **development candidate**, manifest `1.22.0`. The Chrome Web Store may distribute a different build. Use this guide for evaluation, not as a production-readiness certificate.

## Install without affecting an existing profile

1. Open a **separate Chromium test profile**.
2. Clone [BTC Live](https://github.com/jsmlabs/btc-live) or download the source branch.
3. Navigate to `chrome://extensions`; enable Developer mode.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. Click the toolbar icon for the popup; choose **Open Dashboard** to access the full terminal.

**From an Actions build:** Download the artifact matching the source SHA, verify `SHA256SUMS.txt`, unpack the inner candidate ZIP, then load the extracted extension directory. A ZIP itself cannot be selected by Load unpacked. There is no npm build required for use; a network path to the public Binance Futures endpoints is required for data.

## Explore the six workspaces

| Workspace | Start with | Expectations |
| --- | --- | --- |
| Live | BTCUSDT price, 24h range, market status and chart | Inspect age/source labels before making a decision |
| Analytics | Aggressive volume, CVD, displayed liquidity and descriptive comparisons | Incomplete observations are not authoritative volume history |
| Replay | Load a recorded session, scrub/step and compare supported data | Bookmarks are session-local; replay never notifies |
| Alerts | Configure price targets and supported advanced metrics | Advanced checks operate only with an open live dashboard |
| Diagnostics | Inspect reconnects, transport/feed state and freshness | A connected WebSocket does not establish a valid depth book |
| Settings | Personalize view and notification preferences | Local presentation options do not affect exchange data |

**Workspace presets:** Simple shows a reduced set of tabs; Advanced exposes all available workspaces; Custom permits a configured landing workspace. If a view is hidden by the current preset, command navigation does not override that restriction.

## Chart controls

The chart supports **1m, 5m, 15m, 30m, 1h and 4h** intervals with candles, line or area rendering. Use the visible zoom/pan controls, crosshair, selection and drawing tools, including horizontal/trend/measurement/zone annotations where available.

| Input | Action |
| --- | --- |
| `Ctrl+K` / `Cmd+K` (where supported) | Open command palette |
| Arrow keys, Enter, Escape | Navigate/execute/dismiss palette entries |
| `F` (outside editable controls) | Toggle chart-focus presentation |
| `Alt` while drawing/editing | Optional snap to observed OHLC values |

Layouts are **Standard / Wide / Stacked**; densities are **Compact / Comfortable / Analysis**. These are responsive presets, **not** freely dockable panels. Actual keyboard, touch and resize behavior still needs real-browser acceptance.

## How data and alerts work

BTC Live consumes public **BTCUSDT Binance USDⓈ-M Futures** endpoints. CVD uses locally observed aggressive trades and resets/segments on relevant feed discontinuities; book imbalance is a measurement of displayed resting depth. Neither metric identifies particular traders, hidden orders, manipulation nor future direction. Missing, incomplete or stale measurements are unavailable - never assume a displayed zero.

Standard price/percentage alerts can use sampled background REST checks. **Advanced** price, CVD, volume and imbalance rules require a **live open dashboard**, acceptable feed freshness, notification settings, cooldown and Web Locks support for cross-tab serialization. A persisted trigger indicates an attempted notification, not guaranteed OS delivery. See [Alerts](ALERTS.md).

## Recording and replay

Supported sessions are saved locally; event replay can step and seek and supports temporary bookmarks and limited comparisons. A comparison reports coverage/events and price movement, **not trading performance**. Import and storage limits may reject corrupt or oversized sessions. Browser/profile deletion or quota issues can erase local recordings.

## Troubleshooting

| Symptom | Check first |
| --- | --- |
| Blank price or stale data | REST/WS connectivity, device clock, feed-age indicators, diagnostics |
| Book/flow metrics unavailable | Snapshot/diff continuity and trade window completeness; wait for valid resynchronization |
| No notification | Permission, enabled rule, cooldown, browser scheduling, dashboard state and notification history |
| Alerts stopped after closing dashboard | Expected for advanced rules; only supported sampled price checks continue |
| Chart missing interval data | Selected timeframe and exchange-origin candle feed health |
| Replay values missing | Recording coverage/schema and selected session |
| Display clutter or hidden view | Reset preset/layout/density, then review settings |

For reproducible issues, include browser version, source SHA (if unpacked), steps, observed/expected behavior and redacted logs using [Support](../SUPPORT.md). Never post private data or credentials.

**Safety:** BTC Live does not submit trades or guarantee alert delivery. Consult [release readiness](RELEASE.md) before distributing this candidate.

[README](../README.md) · [Full documentation](INDEX.md) · [Privacy](../PRIVACY.md)

