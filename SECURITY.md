# Security Policy

## Security model

BTC Live follows a minimal-permission, local-first Manifest V3 architecture.

Security invariants:

- HTTPS/WSS only
- no remote executable JavaScript
- no `eval()`, `new Function()`, or equivalent dynamic code execution
- no inline scripts or inline event handlers
- no content scripts
- no arbitrary page injection
- no Binance credentials or API keys
- no user account data
- no analytics, telemetry, advertising, or tracking SDKs
- zero runtime package dependencies
- validation of external market-data payloads before state updates
- explicit store runtime allowlist

## External data

Binance responses and WebSocket events are treated as untrusted external input. Runtime validation covers symbols, finite numeric values, order-book relationships, timestamps, sequencing metadata, OHLCV relationships, and kline interval boundaries.

Invalid or stale data cannot silently replace newer validated market state.

## Permissions

BTC Live v1.13.0 requests exactly:

- `storage`
- `notifications`
- `alarms`

Host permission:

- `https://api.binance.com/*`

The background service worker exists only to support persistent market-alert scheduling and does not introduce additional host access.

## Dependency policy

The extension has no runtime npm dependencies. Development verification uses only Node.js built-ins and repository source files.

## Reporting a security issue

Do not publish a suspected vulnerability with exploit details before it can be reviewed. Include the affected version, browser/version, reproduction steps, expected behavior, actual behavior, and impact when reporting a security issue through the repository's private security-reporting channel if enabled.
