# BTC Live privacy policy

**Applicable scope:** The current development candidate on `main` (manifest `1.24.1`). This policy must be rechecked against the **actual approved package** before store publication. A GitHub manifest version is not proof of an installed store release.

## What BTC Live does

BTC Live displays public **BTCUSDT Binance USDⓈ-M Futures** market data in a local-first Chromium extension. It does **not** ask for a Binance account, API key, wallet connection, brokerage credentials or payment information, and it does not place orders.

## Data stored on your device

| Data | Purpose | Browser surface |
| --- | --- | --- |
| Display, layout and chart preferences | Restore your preferred interface | Extension local storage |
| Price/advanced alert rules and internal state | Evaluate thresholds and cooldowns | Extension local storage |
| Trigger history and diagnostics | Show local status and troubleshooting | Extension storage |
| Market captures and supported replay sessions | Local research and replay | IndexedDB |
| Alert text | Deliver enabled notifications | Browser/operating-system notification UI |

Your browser profile, device administrator, backups or exported copies may expose these records. Even observations based on public prices can reveal personal preferences. Protect the profile, inspect exports before sharing them and review browser storage retention.

BTC Live does **not** provide an independent cloud backup or guarantee that locally stored records survive profile deletion, extension removal, storage quota pressure or corruption.

## Network requests and permissions

The current Manifest V3 source requests:

| Access | Why it is requested |
| --- | --- |
| `storage` | Local preferences, alert state and supported history |
| `notifications` | Native browser/OS alerts after user permission |
| `alarms` | Browser-scheduled sampled price checks |
| `https://fapi.binance.com/*` | Read-only public Futures REST endpoints |
| `wss://fstream.binance.com` | Futures live data endpoint allowed by extension CSP |

The reviewed candidate has **no extension permission** to read page contents, browser history or cookies, and declares no project-operated remote account or analytics service. Public Binance endpoints receive necessary network connections; the provider and network intermediaries may observe normal connection metadata. Do not interpret the lack of a developer-operated account as absolute anonymity.

## Notifications and risk limitations

Enabled native notifications display alert content outside the extension UI, potentially on lock screens or connected devices. Market feeds and browser scheduling can fail; BTC Live provides no continuous data, alert-delivery or financial decision guarantee. Advanced flow rules require an open dashboard.

## Changes and reporting

Any new remote service, permission, storage practice or public release must receive an appropriate disclosure update and store-privacy review **before** customers receive it.

For product problems consult [Support](SUPPORT.md); for sensitive vulnerabilities consult [Security](SECURITY.md). See [technical privacy notes](docs/PRIVACY.md) and [current release status](docs/RELEASE.md).

BTC Live is independently developed and is not affiliated with or endorsed by Binance.
