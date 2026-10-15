# BTC Live release checklist

> [!CAUTION]
> **Current decision: NOT APPROVED for customer publication.** Passing CI builds a **development candidate**, not a stable Chrome Web Store package. Keep missing manual evidence unchecked.

## 1. Code, docs and build

- [x] Source verification, deterministic tests and documentation-link checks exist in GitHub Actions.
- [x] Static manifest/permissions/CSP checks and deterministic candidate packaging exist.
- [x] Candidate ZIP checksum and source provenance are emitted by the build.
- [ ] Verify **all** tests and packaging on the *exact final intended release SHA*.
- [ ] Review actual ZIP, permissions, local files and source-to-package version consistency.
- [ ] Confirm all customer-facing documentation reflects the **exact approved build**, not historical source versions.

## 2. Required manual release gates

- [ ] Real Chromium MV3 UI, responsive interaction, accessibility and keyboard.
- [ ] Live Binance Futures REST/WS startup, failure, reconnect and stale-state suppression.
- [ ] Depth sequence gap/snapshot race and resynchronization.
- [ ] Price/advanced alerts across notification permissions, multiple dashboards and worker suspension.
- [ ] Real recording/replay isolation, invalid imports and representative sustained load.
- [ ] Migration from a genuinely installed prior version, state preservation and rollback.
- [ ] Actual screenshots, package metadata, store listing, privacy and security disclosures.

Capture evidence for the seven exact IDs in [Release acceptance](docs/ACCEPTANCE.md).

## 3. Approval and distribution

- [ ] Store complete reviewer-approved evidence **outside the source tree**, bound to the tested full commit SHA.
- [ ] Run `RELEASE_ACCEPTANCE_FILE=dist/release-approval.json npm run release:gate`; inspect linked evidence separately.
- [ ] Reconcile final manifest semver, changelog, GitHub release text, packaging, store copy and image assets.
- [ ] Re-run the complete test and package checks after the final version-related change.
- [ ] Archive the final ZIP, checksum, approval material and tested rollback version.
- [ ] Publish a GitHub tag/release and submit to the Chrome Web Store **only after** approval; separately verify the real public listing.

This is the only **active** release checklist. [The previous v1.22.0 checklist](docs/HISTORICAL-RELEASE-CHECKLIST.md) is an archival record, not present-day acceptance.

[Release procedure](docs/RELEASE.md) · [Testing](docs/TESTING.md) · [Store assets](STORE_ASSETS.md)
