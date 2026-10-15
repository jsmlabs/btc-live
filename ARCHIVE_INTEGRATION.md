# Expanded-workspace archive integration - historical record

> [!NOTE]
> This document preserves earlier archive-import provenance, **not an active instruction to overlay files**. The v16 Phase 01–10 candidate is already integrated into `main`. Integration does not constitute a stable customer release.

## Original archive identity

| Recorded item | Value |
| --- | --- |
| Separately supplied input | `btc-live_v2.2(1).zip` |
| Historical input inventory | **69 runtime files** |
| Archive manifest version | `1.22.0` |
| Original validation | Static JS syntax and local import resolution |
| Integration milestone | Candidate merged via [PR #3](https://github.com/jsmlabs/btc-live/pull/3) |
| Customer release decision | **Pending** independent real-browser and migration acceptance |

The filename contains `2.2` but the archive manifest did **not** declare release version `2.2.0`. At the time of the original documentation-only review, the complete archive was not yet pushed. The subsequent integration into `main` changed that status. Neither event proves store publication.

## Contracts guiding integration

- Preserve regression tests, CI scripts, existing documentation and source history.
- Validate public Binance Futures REST/WS payloads and bound depth/snapshot/reconnect behavior before deriving analytics.
- Distinguish resting order-book levels from aggressive trade executions. Neither reveals hidden orders or real liquidation events.
- Keep recorded replay isolated from live market state and notifications.
- Validate persisted settings and imported recordings, maintaining privacy and permission boundaries.
- Avoid unsupported version, performance and production-readiness claims.

## Current build procedure

The former `scripts/runtime-files.mjs` and `scripts/build-store.mjs` are retired. Use:

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
```

This creates a reproducible **development candidate**, not an approved Chrome Web Store ZIP. Releasing it requires [manual acceptance](docs/ACCEPTANCE.md) and the current [release procedure](docs/RELEASE.md).

[README](README.md) · [Architecture](docs/ARCHITECTURE.md) · [Changelog](CHANGELOG.md)
