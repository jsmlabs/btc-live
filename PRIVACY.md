# Privacy Policy - BTC Live

> **Scope:** This document describes the repository's v16 development candidate (manifest `1.22.0`), **not** a guarantee that the same package is already available in the Chrome Web Store. Privacy disclosures must be reviewed again against the exact approved customer build.

BTC Live is designed to show **public BTCUSDT Binance USDⓈ-M Futures market data** directly in a Chromium extension. It does not require a login, wallet connection, Binance credentials or API keys, and does not place orders.

## Data handling

| Category | Intended use | Location |
| --- | --- | --- |
| Interface, chart and workspace settings | Remember user preferences | Browser extension storage |
| Configured alerts, cooldown/rearm state and history | Evaluate and display alerts | Browser extension storage |
| Session and feed diagnostics | Troubleshooting and status display | Browser extension state/storage |
| Recorded events and replay sessions | Local playback and comparison | IndexedDB in the browser profile |
| Notification text | Show configured alert content | Browser and operating-system notification interface |

The extension has **no project-operated account system or market-data backend**, and the reviewed manifest does not request browsing-history, cookies, page-content or wallet access. The candidate is designed without developer-operated telemetry, ads, trackers or analytics SDKs. Public Binance endpoints receive network requests needed to provide market data; standard network metadata may be visible to the exchange and network intermediaries.

## Permissions and external connections

| Declaration | Purpose |
| --- | --- |
| `storage` | Save preferences, rules and supported local state |
| `notifications` | Display permitted native alerts |
| `alarms` | Schedule sampled background price checks |
| `https://fapi.binance.com/*` | Fetch public USDⓈ-M Futures REST data |
| `wss://fstream.binance.com` (CSP) | Subscribe to public Futures market streams |

There are no content scripts or order-submission permissions in the reviewed candidate manifest. Browser profile access, OS notifications, exports, screenshots and diagnostics can expose saved observations or preferences. Users should control local storage, exported copies and access to their devices.

## Reliability and retention

Recorded sessions and settings persist according to browser storage behavior and application-supported cleanup paths; do not assume browser storage provides encrypted backup or indefinite retention. Browser closure, extension removal, profile deletion, quota pressure or corruption can result in loss of locally stored state. Background checks are sampled, not continuous.

## Changes and contact

Before a public release, verify this policy, extension permissions and the store privacy questionnaire against the **exact published package**. For a private security concern, see [SECURITY.md](SECURITY.md). For usage issues, see [SUPPORT.md](SUPPORT.md).

[Detailed data handling](docs/PRIVACY.md) · [Release status](docs/RELEASE.md)
