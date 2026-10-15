# Phase 10 - Release & Regression

Status: **historical Phase 10 development milestone / NOT PRODUCTION-VERIFIED**. The current build process produces provenance and checksums, while [release acceptance](ACCEPTANCE.md) remains mandatory.

## Executed verification

- `npm run verify` performs syntax/reference checks and deterministic tests.
- `npm run release:check` checks manifest contracts, restrictive permissions/CSP, local HTML references and unexpected large artifacts.
- Historical Phase-10 packaging checks described deterministic ZIP output. The integrated branch now implements `npm run package:extension` to create one candidate ZIP with sorted entries and fixed timestamps. CI validates archive structure and contents, but no public release is approved until the candidate passes all release gates.
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
