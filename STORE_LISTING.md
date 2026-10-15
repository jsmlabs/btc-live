# BTC Live - Chrome Web Store listing draft

> [!CAUTION]
> **Not approved or submitted by this repository update.** Verify the actual public Chrome Web Store package before publication; source manifest `1.24.1` and candidate features alone do **not** establish live availability.

## Proposed product metadata

| Field | Draft |
| --- | --- |
| Name | BTC Live |
| Audience | BTCUSDT Futures market monitors and researchers |
| Category | Tools |
| Primary language | English |
| Product type | Local-first Chromium market dashboard |
| Authentication | No Binance login, wallet or API keys |
| Distribution status | **Draft - final features and assets require acceptance** |

The description below is **proposed copy for a future reviewed build**, not a claim that users can currently install its expanded functionality from the public store.

## Description draft

```text
BTC Live — Bitcoin Futures Market Monitoring

Observe BTCUSDT Binance USDⓈ-M Futures market activity from your Chromium browser. BTC Live combines a compact price-monitoring popup with a dark, dedicated research dashboard.

LIVE MARKET OVERVIEW
• Public BTCUSDT Futures price and 24-hour market context
• Feed health, update freshness and connection diagnostics
• Candlestick, line and area charts with multiple timeframes
• Bid/ask, spread and displayed order-book information

RESEARCH AND REPLAY
• Observed aggressive trade volume and rolling cumulative volume delta (CVD)
• Descriptive book-depth and flow metrics
• Local recording and supported session replay
• Chart navigation, drawing and workspace layout options

ALERTS AND PERSONALIZATION
• User-defined price and percentage-move alerts
• Advanced live dashboard rules for price and supported flow metrics
• Local alert state/history and native browser notifications
• Preferences and recordings stored on your device

PRIVACY AND CONTROL
• No Binance account, API keys or wallet access required
• No order submission or automated trading
• Direct access to public Binance Futures market endpoints
• No project-operated account system required

IMPORTANT
BTC Live is for informational monitoring and research, not investment advice, execution or guaranteed trade signals. Data may be delayed, incomplete or unavailable. Background price checks are sampled, and advanced rules require an open dashboard. Notification delivery is not guaranteed.

BTC Live is independent and is not affiliated with or endorsed by Binance.
```

Remove or revise any feature **not actually demonstrated** in the intended store build. The final description must match store language/format limits and the reviewed package.

## Why these permissions exist

| Declaration | Justification |
| --- | --- |
| `storage` | Local settings, alert rules/state, diagnostics and supported history |
| `notifications` | Browser/OS alerts when allowed |
| `alarms` | Scheduled sampled background checks |
| `https://fapi.binance.com/*` | Public Binance Futures REST |
| CSP: `wss://fstream.binance.com` | Public Binance Futures streams |

There is no need to request a trading account or page-content permissions for the current architecture.

## Before submission

1. Inspect the **actual currently published** listing and version.
2. Complete [real candidate acceptance](docs/ACCEPTANCE.md), including accessibility, feed failure and migration.
3. Verify screenshots/icons against the **final tested package**; replace any assets that do not match its actual interface.
4. Reconcile name, summary, description, permissions, privacy questionnaire, support/security links and final manifest version.
5. Save draft, resolve Chrome Web Store validation issues, then submit only an **approved customer build**.
6. Verify review outcome and published status independently. A GitHub commit, successful ZIP or saved draft does **not** publish the extension.

[Asset standards](STORE_ASSETS.md) · [Privacy](PRIVACY.md) · [Release](docs/RELEASE.md)
