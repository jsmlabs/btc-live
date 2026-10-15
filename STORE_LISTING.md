# BTC Live - Chrome Web Store listing

> [!IMPORTANT]
> **Draft, not approved for publication.** Historical store-editor evidence reviewed on **2026-10-15** showed public version **1.21.0**. The repository manifest is `1.22.0` and `main` contains v16 development candidate features. Do not infer the current store version from source or assume these candidate features are already shipped.

## Product positioning

| Field | Draft |
| --- | --- |
| Product | BTC Live |
| Store category | Tools |
| Language | English |
| Market | BTCUSDT, Binance USDⓈ-M Futures |
| Product | Local-first Chromium market monitoring and research |
| API keys / trading | Not required / not supported |
| Customer release status | **Pending** [acceptance](docs/ACCEPTANCE.md) |

## Proposed customer description - review before publishing

```text
BTC Live - Bitcoin Futures Market Monitoring

Follow BTCUSDT market activity from public Binance USDⓈ-M Futures feeds directly in your browser. BTC Live combines a compact market popup with a dedicated dark monitoring and research dashboard.

LIVE MARKET MONITORING
- BTCUSDT Futures price and 24-hour market statistics
- Best bid and ask, spread and connection/freshness indicators
- Candlestick, line and area chart views with supported intervals
- Feed diagnostics and recovery indicators

MARKET RESEARCH
- Observed executed volume, rolling cumulative volume delta (CVD), and displayed order-book depth
- Chart drawing and layout controls
- Supported local session recording and replay

CUSTOMIZABLE ALERTS
- Price and percentage-move rules with browser notifications
- Advanced price and order-flow rules while a live dashboard is open
- Local alert history and sampled background price checks

PRIVACY AND CONTROL
- No account, Binance API key, wallet access or order permission required
- Direct connections to public Binance Futures endpoints
- Supported settings and sessions stored locally in the browser
- No trade or order execution

IMPORTANT: BTC Live provides descriptive market information, not trading signals or advice. Data can be stale, missing or incomplete. Browser alarms and notifications are not guaranteed; advanced rules require an open dashboard. Do not rely on alerts as a sole risk control.

BTC Live is an independent project, not affiliated with or endorsed by Binance.
```

**Do not paste this candidate description into a live store listing** until the final tested build, feature coverage, version and store assets match every claim.

## Permission explanations

| Access | Justification |
| --- | --- |
| `storage` | Browser-local preferences, alerts and recorded state |
| `notifications` | Native notifications for enabled rules |
| `alarms` | Sampled background price checks |
| `https://fapi.binance.com/*` | Public Futures REST data |
| `wss://fstream.binance.com` in CSP | Public Futures WebSocket feeds |

## Publication steps

1. Verify the current **live** Chrome Web Store package/version independently.
2. Complete [manual release acceptance](docs/ACCEPTANCE.md) against the exact source/build.
3. Capture [genuine screenshots](STORE_ASSETS.md) of that build; do not reuse historic Spot imagery.
4. Review the listing, category, language, claims, privacy questionnaire, support/security links, icons and permissions.
5. Save and review the developer-console draft; submit **only** the approved build. A saved draft does not mean published.
6. Track store approval and actual public visibility separately from GitHub CI/release status.

[Privacy Policy](PRIVACY.md) · [Security](SECURITY.md) · [User guide](docs/USAGE.md) · [Release](docs/RELEASE.md)
