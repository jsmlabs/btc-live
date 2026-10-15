# Release readiness and version policy

**Status as of 2026-10-15:** v16 Phase 01-10 is a **development candidate**, not a published, production-approved version. `manifest.json` still reports **1.22.0**. The candidate was integrated into `main` by [merged PR #3](https://github.com/jsmlabs/btc-live/pull/3) (merge commit [`70977d9`](https://github.com/jsmlabs/btc-live/commit/70977d92f5b9b84a6906698a4cde7c16688ffeca)). **Integration into `main` is not equivalent to release approval.** Historical v1.22.0 release notes remain separate.

## Evidence and status

| Area | Recorded evidence | Current decision |
| --- | --- | --- |
| Candidate-only deterministic tests | Phase-10 checkout previously reported 45 passing tests | Historical result; rerun and verify on the current `main` head |
| Static imports, manifest and packaging | Candidate Phase-10 validation previously passed | Run on the exact release commit and record CI |
| Chromium popup/dashboard | No accepted end-to-end evidence recorded | **Blocked** |
| Binance feed and depth recovery | No accepted live/reconnect sequence recorded | **Blocked** |
| MV3 lifecycle and multi-tab notifications | No accepted suspension/race evidence recorded | **Blocked** |
| Long-session resources and replay | No accepted performance and memory evidence recorded | **Blocked** |
| Existing-install migration | Not fully established | **Blocked** |

Passing scripts or a green CI run must not be presented as live-browser, market-feed or production evidence. Verification uses bounded subprocesses and fails closed on timeouts or invalid source-tree entries; cancelled CI runs are not passes.

## Version rules

- **1.22.0** is the extension manifest and historical stable release identifier, not a substitute name for v16.
- **v16 candidate** identifies a development milestone, not a published Chrome Web Store release.
- Do not bump the manifest, publish store packages, create a stable release tag, or mark PR #3 release-ready until all gates are satisfied.
- When ready, choose a single version and update the manifest, release notes, changelog, package metadata and public listing together. Preserve release artifacts and a rollback path.

## Required acceptance procedure

1. **Integrate:** PR #3 was merged; review the integrated `main` diff and ensure that all changes since the merge remain covered by validation.
2. **Verify:** In a clean checkout at the candidate commit run `npm run verify`, `npm run release:check` and `npm run package:extension`. The last command now creates a deterministic ZIP in `dist/`; record OS, Node version, commit SHA, exit codes and the package checksum.
3. **Exercise in Chromium:** Install unpacked, inspect extension/background consoles and verify popup/dashboard, focus, keyboard, responsive breakpoints, chart pointer behavior and notification permissions.
4. **Exercise feeds:** Test real Binance REST/WS startup, stale/disconnect/reconnect conditions, depth gaps, snapshot resync and suppression of invalid dependent metrics.
5. **Exercise lifecycle:** Test browser restart, MV3 worker suspension, multiple tabs, alert at-most-once *attempt* semantics, denied notifications and dashboard-closed behavior.
6. **Exercise load/migration:** Run representative prolonged sessions, observe memory/CPU/rendering/queues, test persisted settings and upgrade from the existing version.
7. **Release only after acceptance:** Update consistent version identifiers, inspect the generated candidate ZIP and CI artifact, verify its contents/checksums, then promote only an accepted release build, publish from the tested commit and preserve rollback artifacts.

Use [Testing](TESTING.md) for test evidence and [Alerts](ALERTS.md) for notification caveats. Any missing or failed gate remains a release blocker.
