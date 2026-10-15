# Privacy and data handling - development candidate

> Scope: v16 Phase 01–10 in `main` with manifest `1.22.0`. This is **not** a released store package or an independent privacy-audit certification. Review the exact final extension before distribution.

BTC Live reads public BTCUSDT Binance USDⓈ-M Futures market data. It does not require a Binance account, API key, wallet access or trading permission.

## Browser access

| Declaration | Purpose |
| --- | --- |
| `storage` | Local preferences, alerts/history, diagnostics and supported sessions |
| `notifications` | Native browser/OS alerts |
| `alarms` | Periodically scheduled price checks, subject to browser lifecycle |
| `https://fapi.binance.com/*` | Public Futures REST data |
| CSP `wss://fstream.binance.com` | Public Futures WebSocket streams |

There are no content scripts or project-operated account, tracking or analytics services declared in the reviewed candidate. Public Binance endpoints and network intermediaries may receive standard connection metadata.

## Local state and exports

Browser extension storage holds display/chart/workspace preferences, rules, alerts and available diagnostics. IndexedDB can contain recorded market events and replay sessions. A local profile, exported session, screenshot, notification or debug log can disclose observations and preferences even when the underlying exchange data are public.

Protect profile access, control exports and avoid sharing unredacted diagnostics. Browser storage limits, profile deletion, extension removal, OS behavior and local cleanup determine persistence and availability. No cloud backup or guaranteed retention is promised.

## Reliability and disclosure

Stale/missing data must be treated as unavailable. Advanced alerts need a live open dashboard; sampled background checks are not continuous and may miss conditions or fail to deliver notifications.

Before customer publication, reconcile the store privacy answers and current policy with the exact packaged and accepted extension.

[Privacy Policy](../PRIVACY.md) · [Security](../SECURITY.md) · [Acceptance](ACCEPTANCE.md)
