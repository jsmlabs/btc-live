# Phase 10 - Release & Regression

Status: **RELEASE CANDIDATE / NOT PRODUCTION-VERIFIED**.

## Executed verification

- `npm run verify` performs syntax/reference checks and deterministic tests.
- `npm run release:check` checks manifest contracts, restrictive permissions/CSP, local HTML references and unexpected large artifacts.
- Two deterministic ZIP outputs are generated with a fixed timestamp, sorted entries and SHA-256 checksums.
- Release checks do not prove runtime correctness or real market connectivity.

## Release blockers / evidence still required

1. Chromium MV3 extension load and popup/dashboard visual smoke tests (including command palette, focus, responsive layout).
2. Live Binance feed reconnect / stale and depth resync behavior.
3. Cross-tab Web Locks race, alert permission-denied delivery and MV3 service-worker suspension/resume.
4. Large-session replay responsiveness, memory growth and long-duration load measurements.
5. Review of the existing installation path and confirm public distribution policy before a manifest version bump.

The archived `v15.1` label is not treated as a manifest version. Manifest intentionally remains `1.22.0`. Do not claim public v16 release from these packages.

## Manual smoke checklist

Use `docs/SMOKE-TEST.md` and preserve observations with browser/version, timestamp and actual evidence. Checklist items are not marked passed by static checks.
