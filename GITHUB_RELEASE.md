# BTC Live v1.14.0

BTC Live v1.14.0 migrates the complete BTCUSDT market-data path from Binance Spot to Binance USDⓈ-M Futures while preserving the existing alert, dashboard, chart, settings, diagnostics, and local-storage contracts.

## Highlights

- BTCUSDT USDⓈ-M Futures as the only market-data source
- Futures aggregate trades for live price updates
- Futures 24h ticker for rolling market statistics
- Dedicated Futures `bookTicker` stream and REST fallback for best bid, best ask, and spread
- Futures klines for dashboard chart reconciliation
- Separate ordering for ticker statistics and top-of-book state
- Guards against accidental restoration of legacy Spot REST/WebSocket endpoints
- Existing multi-target alerts and background monitoring preserved
- 106 deterministic automated tests
- 35-file explicit store runtime allowlist
- Zero runtime dependencies

## Permissions

- `storage`
- `notifications`
- `alarms`
- Binance USDⓈ-M Futures REST host access: `https://fapi.binance.com/*`
- Binance USDⓈ-M Futures WebSocket access through CSP: `wss://fstream.binance.com`

## Privacy

No account, API key, wallet connection, analytics provider, advertising network, tracking system, or custom backend is used.

## Verification

```bash
npm run release:check
```

Expected result:

```text
106 / 106 tests passing
35 runtime files in dist/btc-live-chromium-v1.14.0-store
```

## Package

- `btc-live-chromium-v1.14.0-store.zip` - Chromium-based browsers

## Data source

Market data is provided by Binance public USDⓈ-M Futures market-data services for BTCUSDT. BTC Live is independent and is not affiliated with or endorsed by Binance.
