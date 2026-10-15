# Release readiness

**Current state: v16 candidate source, not an approved production or store release.** `manifest.json` and its `1.22.0` version are deliberately unchanged pending browser acceptance.

## Completed static verification

- Phase 01-10 development changes are assembled in candidate source.
- 45 deterministic tests passed in the Phase 10 environment.
- Manifest/CSP/import/reference checks and deterministic ZIP integrity checks passed in the Phase 10 environment.
- No additional runtime npm dependencies, permissions or exchange API keys were introduced by the candidate phases.

## Open release blockers

- Full Chromium extension install and popup/dashboard acceptance.
- Live Binance data freshness, snapshot resync and reconnect recovery.
- MV3 suspend/resume plus alert delivery permission failures and cross-tab races.
- Long-session replay performance, resource and memory growth.
- Confirmation of migration/update behavior and public distribution/version policy.

## Release procedure

1. Run `npm run verify` and `npm run release:check` from a clean checkout.
2. Perform and record browser/live/manual smoke tests (`TESTING.md`).
3. Audit storage and permission changes; confirm compatibility with the currently published extension.
4. Only after all release gates, choose a coherent manifest, package and GitHub release version and update changelog/release notes.
5. Package, verify checksums and publish from the accepted commit, preserving rollback artifacts.

Historical upstream release documentation, if retained, describes previous stable versions, not this candidate.
