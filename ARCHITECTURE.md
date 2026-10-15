# BTC Live architecture

**Current source:** `main` contains the v16 Phase 01–10 development candidate with extension manifest `1.22.0`. This is **not** an approved stable release. For the detailed module contracts and data boundaries, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Runtime overview

```text
             Binance Futures (public REST + WebSocket)
                             |
                   market/ (validation)
                             |
                    app/ (live runtime)
                             |
                ui/ (presentation selectors)
                      /              \
                 popup/           dashboard/
                                      |
                           analysis, replay, alerts

background/   MV3 service worker + sampled price checks
storage/      local preferences, alert state, recording sessions
```

Price, 24-hour statistics, aggregate trades, exchange-origin klines and synchronized depth have distinct sequencing/freshness boundaries. Invalid/stale state must not be silently presented as live or converted into zero. Resting book depth is not executed volume; replayed historical events cannot trigger live notifications.

## Trust boundaries

| Component | Required invariant |
| --- | --- |
| Binance streams | Validate untrusted symbols, numeric values, timestamps and sequence continuity |
| State and analytics | Preserve provenance/freshness; invalidate dependent metrics on feed gaps |
| Storage | Sanitize untrusted preferences, rules and recordings; handle quota/failure paths |
| Alerts | Live-data gating, bounded evaluation and browser permission/worker limitations |
| Packaging | Local runtime resources, limited permissions, restrictive CSP and deterministic archive |
| UI | Monitoring and research only; no account credentials, wallet or trade execution |

Permissions are `storage`, `notifications`, `alarms`; host access is `https://fapi.binance.com/*`, and the CSP permits the matching Futures WebSocket endpoint. Source/runtime contracts must be checked at the **exact build SHA**.

## Verification

`npm run verify` runs static checks and deterministic tests; `npm run release:check` validates static release contracts; `npm run package:extension` builds the candidate ZIP. **None establishes actual Chromium, MV3, Binance, migration or notification acceptance.**

The prior archive overlay proposal has been incorporated into `main` as a candidate; the archival process is retained in [ARCHIVE_INTEGRATION.md](ARCHIVE_INTEGRATION.md) for provenance, not as an active import task.

[User guide](docs/USAGE.md) · [Detailed architecture](docs/ARCHITECTURE.md) · [Release readiness](docs/RELEASE.md)
