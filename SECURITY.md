# Security Policy

## Security Model

BTC Live follows a minimal-permission, local-first architecture.

Security invariants:

- HTTPS/WSS only
- no remote executable JavaScript
- no `eval()` or equivalent dynamic code execution
- no Binance credentials or API keys
- no user account data
- no content scripts
- no arbitrary page injection
- no telemetry or advertising SDKs
- validation of all external market-data payloads before state updates

## External Data

Binance responses are treated as untrusted external input. Invalid symbols, non-finite numbers, impossible bid/ask relationships, negative values, and implausible timestamps are rejected.

Invalid data never replaces the last valid market state.

## Permissions

V1 requests only the browser `storage` permission and the Binance REST host permission required for the public market snapshot.

## Reporting a Security Issue

Do not publish a suspected vulnerability with exploit details before it can be reviewed. Report the affected version, reproduction steps, impact, and any relevant browser information through the project's private security-reporting channel when one is configured.
