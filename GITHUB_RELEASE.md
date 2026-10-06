# BTC Live v1.13.0

BTC Live v1.13.0 adds a persistent multi-target price-alert manager and local alert history on top of the existing Chromium Manifest V3 market-monitoring, dashboard, chart, and notification architecture.

## Highlights

- Multi-target BTC price alerts with independent `Above` / `Below` direction
- Optional labels and per-target enable/disable controls
- Deterministic trigger and re-arm state per target
- Automatic migration from v1.12.0 single price targets
- Local alert history for sent, suppressed, and failed events
- Alert source and target context for diagnostics
- Deterministic handling when one market move crosses multiple targets
- Persistent background checks through an MV3 service worker and Chromium alarms
- Shared popup/dashboard market runtime and settings synchronization
- 96 deterministic automated tests
- 35-file explicit store runtime allowlist
- Zero runtime dependencies

## Permissions

- `storage`
- `notifications`
- `alarms`
- Binance public Spot REST host access only

## Privacy

No account, API key, wallet connection, analytics provider, advertising network, tracking system, or custom backend is used.

## Verification

```bash
npm run release:check
```

Expected result:

```text
96 / 96 tests passing
35 runtime files in dist/btc-live-chromium-v1.13.0-store
```

## Package

- `btc-live-chromium-v1.13.0.zip` - Chromium-based browsers

## Data source

Market data is provided by Binance public Spot market-data services. BTC Live is independent and is not affiliated with or endorsed by Binance.
