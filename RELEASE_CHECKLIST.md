# BTC Live - release checklist

> [!IMPORTANT]
> **NOT APPROVED FOR PUBLICATION.** The v16 development candidate is integrated into `main`, while the manifest still declares `1.22.0`. The [historic v1.22.0 checklist](docs/HISTORICAL-RELEASE-CHECKLIST.md) is archived for provenance.

## Automated build
- [x] Static validation and deterministic Node regression tests run in CI.
- [x] Runtime-only candidate ZIP, reproducibility checks and SHA-256 provenance exist.
- [x] A separate `npm run release:gate` requires evidence bound to an exact source commit.
- [ ] Confirm **all** CI jobs passed on the exact final intended release SHA.
- [ ] Inspect the final candidate artifact and its `BUILD_INFO.json` / `SHA256SUMS.txt`.

## Real customer acceptance
- [ ] Chromium MV3 popup, dashboard, responsiveness, keyboard and chart gestures.
- [ ] Live Binance Futures REST/WebSocket reconnect, stale data and order-book resync.
- [ ] Multiple dashboards, notification permissions, background alarms and worker suspension.
- [ ] Invalid/corrupt recording import, replay isolation and sustained performance.
- [ ] Existing-install storage migration/rollback, no loss of supported user state.
- [ ] Actual screenshots, privacy, security, support and store claims match the release package.

Each case needs independent evidence; details are in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

## Stable promotion
- [ ] Approve an **external**, SHA-bound evidence record and run `npm run release:gate`.
- [ ] Reconcile manifest, package metadata, changelog, release notes and store version.
- [ ] Rebuild from tested source, verify package SHA-256 and retain rollback assets.
- [ ] Create an approved GitHub version tag/release.
- [ ] Submit verified assets and package to the Chrome Web Store; verify publication separately.

[Release policy](docs/RELEASE.md) · [Testing](docs/TESTING.md) · [Store assets](STORE_ASSETS.md)
