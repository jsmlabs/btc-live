# Using BTC Live

## First run

Load the unpacked extension from the directory containing `manifest.json`, open the toolbar popup and then the full dashboard. A live connection needs access to public Binance Futures endpoints. Inspect the connection-state and feed-age diagnostics before interpreting order-flow metrics.

## Market workspace

The chart offers available line/candlestick modes, supported intervals, crosshair and zoom/pan controls. Drawings support selection, undo/redo and optional OHLC snapping (Alt while editing/drawing). Visible price/time coordinates remain authoritative. Shortcut `Ctrl+K` (or `Cmd+K` where supported) opens the command palette; `F` toggles chart focus outside text fields. The presets Standard/Wide/Stacked and Compact/Comfortable/Analysis alter panel composition, not market data.

## Analytics

CVD measures signed aggressive executed volume from observed trade records over rolling windows. Divergences compare price movement against observed delta; book imbalance is derived from displayed order-book sizes. These are **descriptive**, subject to partial coverage and latency. Do not infer hidden liquidity, spoofing or guaranteed absorption from persistence alone. Missing or stale data must be treated as unavailable, not zero.

## Replay and research

Load an available recording, scrub its timeline or use backward/forward steps. Bookmarks are session-local and disappear when loading another recording. Comparison summarizes events, duration, price change and data coverage; it does not estimate trading profitability. Replay is isolated from all live alert notifications.

## Alerts

Price and percentage-move alerts have existing browser and scheduled-background behavior. Advanced rules cover price, CVD, executed volume and book imbalance when the **dashboard is open** and feed validity permits evaluation. Permission-denied notification events, disconnected feeds and browser suspension can prevent delivery. See [Alert semantics](ALERTS.md).

## Troubleshooting

- **No updates:** Check Binance endpoint availability, network policy and the diagnostics workspace.
- **Depth unavailable:** Wait for a valid snapshot/resynchronization, rather than trusting older book metrics.
- **No advanced alert:** Keep the dashboard open, verify notifications and feed validity, review cooldown and stored history.
- **Missing replay values:** Check event coverage and integrity; not every recording contains all metrics.
- **Unexpected layout:** Restore a supported layout preset or change density in settings.

The candidate still requires browser integration testing before production use.
