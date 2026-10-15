# BTC Live - Chrome Web Store Listing

> **Store evidence (screenshot, 2026-10-15):** BTC Live is shown as **Published - public**, version **1.21.0**, with an empty Description field in the developer listing editor. The repository currently declares **1.22.0**, which is **not evidence of store publication**. This copy is deliberately limited to established 1.21.0-era features. No direct store changes are made by this GitHub documentation update.

## Product details

- **Title from package:** BTC Live
- **Primary language:** English
- **Category:** Tools
- **Store Description:** Copy the plain text below into the required Description field (limit shown in the screenshot: 16,000 characters).
- **Package summary:** Controlled by `manifest.json` in the uploaded extension package, not by this listing Description field.

## Description - copy and paste

```text
BTC Live - Bitcoin Futures Market Monitoring

Monitor Bitcoin's market activity directly from your browser. BTC Live is a lightweight Chrome extension that provides real-time BTCUSDT market data from Binance USDⓈ-M Futures, interactive charting, market diagnostics, and configurable price alerts.

Whether you need a quick price check or a dedicated market-monitoring workspace, BTC Live keeps essential information accessible without requiring a trading account.

KEY FEATURES

LIVE BITCOIN MARKET DATA
- BTCUSDT Futures price updates
- 24-hour price change, open, high, low, and volume
- Best bid, best ask, and bid-ask spread
- Market connection status and data freshness indicators
- Automatic reconnection and REST data recovery

INTERACTIVE MARKET DASHBOARD
- Dedicated full-page monitoring dashboard
- Candlestick and line charts
- 1-minute, 5-minute, and 15-minute chart intervals
- Optional trading volume display
- Market reference levels and 24-hour range
- Responsive dark interface

CUSTOMIZABLE PRICE ALERTS
- Native browser notifications
- Percentage-based price movement alerts
- Multiple price targets above or below the market
- Configurable notification cooldowns
- Automatic target rearming
- Local alert history
- Optional periodic background price checks

PRIVACY AND CONTROL
- No registration or Binance account required
- No API keys or wallet connections
- No analytics, advertising, or tracking
- Preferences and alerts stored locally in your browser
- Direct access to public Binance Futures market data
- No trading or order execution

BUILT FOR EVERYDAY MONITORING

Use the compact extension popup for a fast market overview, or open the dashboard for detailed charting, connection diagnostics, and alert management.

IMPORTANT INFORMATION

BTC Live provides market data for informational purposes only. Background price checks are periodic rather than continuous, and browser scheduling or connectivity interruptions may delay notifications. Market data can also become unavailable or stale.

BTC Live is an independent project and is not affiliated with or endorsed by Binance.

Bitcoin market monitoring, without the noise.
```

## Permission justifications

These are supporting explanations for the Privacy/permissions declarations; they are not a substitute for reviewing the exact deployed package.

| Permission | Reason |
| --- | --- |
| `storage` | Save display/chart settings, notification options, targets, bounded history and diagnostic state locally |
| `notifications` | Display enabled BTC price and connection alerts using browser notifications |
| `alarms` | Schedule periodic background price checks when the user enables them |
| `https://fapi.binance.com/*` | Fetch public BTCUSDT Binance USDⓈ-M Futures market information; the separate WebSocket connection is constrained by CSP |

The declared WebSocket endpoint is `wss://fstream.binance.com`. No content scripts, exchange credentials, wallet access, order execution, analytics or developer-operated tracking backend are part of the described design.

## Publishing procedure

1. Open the existing **BTC Live** item in Chrome Web Store Developer Dashboard.
2. Under **Store listing**, paste the Description text and retain the **Tools** category.
3. Review the store language, screenshots, icons, links, privacy answers and package/version to make sure they match what users actually receive.
4. Choose **Save draft**, resolve any validation errors and review the draft.
5. Submit the listing update for review when ready. Saving a draft does not itself publish the new description.

**Do not** claim the repository's 1.22.0 changes or the unmerged depth/order-flow/replay archive are deployed to the public listing without checking the actual Chrome Web Store package.

## References

- [README](README.md)
- [Privacy Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Store Asset Plan](STORE_ASSETS.md)
- [Release Checklist](RELEASE_CHECKLIST.md)
