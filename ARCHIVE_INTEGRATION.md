# BTC Live expanded-workspace archive integration

## Status (reviewed 2026-10-15)

**Historical integration record:** This document preserves the original import contract for a separately supplied archive. Since that record was written, the v16 Phase 01–10 candidate has been merged into `main` by [PR #3](https://github.com/jsmlabs/btc-live/pull/3). Do not treat this historical import status as the current source state or as stable release approval. See [release readiness](docs/RELEASE.md).



The separately supplied archive `btc-live_v2.2(1).zip` contains 69 runtime files. **At the time of the original archive review, that ZIP had not been imported by the documentation-only commit.** Its `manifest.json` declares version `1.22.0`, despite the archive filename. Do not advertise or tag this snapshot as 2.2.0 without an explicit version decision.

## Historical safe integration procedure (superseded)

1. Pin the current `main` commit and inspect its full tree before modifying files.
2. Overlay the 69 archive files by relative path; do not delete repository-only `tests/`, `scripts/`, `.github/`, `store-assets/`, existing documentation, package metadata or license.
3. Inspect differences in modified existing runtime modules; ensure the new order-book, aggregate-trade, replay, dashboard and advanced-alert paths preserve existing behavior.
4. At that time, expand the former `scripts/runtime-files.mjs` allowlist; **that script has since been retired**. The current `scripts/package-extension.mjs` builds from reviewed runtime directories.
5. Add deterministic tests for depth snapshot/delta sequencing, stale-book degradation, aggregate-trade validation, replay import/export, storage quotas, live/replay separation, advanced alert rules and notification deduplication.
6. Align `manifest.json`, `package.json`, popup/dashboard labels, changelog, README, privacy/security policies, release notes and store packaging on the **approved** version.
7. Run `npm run verify`, `npm run release:check` and Chromium MV3 manual tests. Confirm updated CI is green before tagging or release publication.

## Data boundaries

Order-book depth means currently displayed liquidity, not executed volume or liquidations. Aggregate trades mean reported executions, not resting orders. Replay must not drive live notifications or silently contaminate the live market state. All exchange payloads, persisted records and imported replay content are untrusted and require validation.

## Verification limitations

The archive's 60 JavaScript modules passed `node --check` in Node.js 22.16.0 and its static relative module references resolved locally. These are not functional, integration, browser-runtime or security-audit results. The full archive code had **not** been pushed by the original documentation-only commit. The v16 candidate was subsequently integrated into `main` and remains subject to [release acceptance](docs/ACCEPTANCE.md).
