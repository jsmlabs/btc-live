# BTC Live expanded-workspace archive integration

## Status (reviewed 2026-10-15)

**Implementation has not been merged into `main`.** This document is the integration contract for the separately delivered package, not a release declaration.



The separately supplied archive `btc-live_v2.2(1).zip` contains 69 runtime files. **The archive has not been imported into this GitHub repository by this documentation commit.** Its `manifest.json` declares version `1.22.0`, despite the archive filename. Do not advertise or tag this snapshot as 2.2.0 without an explicit version decision.

## Safe integration procedure

1. Pin the current `main` commit and inspect its full tree before modifying files.
2. Overlay the 69 archive files by relative path; do not delete repository-only `tests/`, `scripts/`, `.github/`, `store-assets/`, existing documentation, package metadata or license.
3. Inspect differences in modified existing runtime modules; ensure the new order-book, aggregate-trade, replay, dashboard and advanced-alert paths preserve existing behavior.
4. Expand `scripts/runtime-files.mjs` and store packaging for every new imported runtime module and asset.
5. Add deterministic tests for depth snapshot/delta sequencing, stale-book degradation, aggregate-trade validation, replay import/export, storage quotas, live/replay separation, advanced alert rules and notification deduplication.
6. Align `manifest.json`, `package.json`, popup/dashboard labels, changelog, README, privacy/security policies, release notes and store packaging on the **approved** version.
7. Run `npm run verify`, `npm run release:check` and Chromium MV3 manual tests. Confirm updated CI is green before tagging or release publication.

## Data boundaries

Order-book depth means currently displayed liquidity, not executed volume or liquidations. Aggregate trades mean reported executions, not resting orders. Replay must not drive live notifications or silently contaminate the live market state. All exchange payloads, persisted records and imported replay content are untrusted and require validation.

## Verification limitations

The archive's 60 JavaScript modules passed `node --check` in Node.js 22.16.0 and its static relative module references resolved locally. These are not functional, integration, browser-runtime or security-audit results. The full archive code has **not** been pushed by this commit.
