# Release readiness and version policy

> [!IMPORTANT]
> **Status: development candidate / NOT APPROVED FOR PUBLIC RELEASE.** The `main` branch includes the v16 Phase 01–10 implementation, but `manifest.json` remains `1.22.0`. Neither a successful CI run nor an automatically generated package authorizes customer publication.

## Current release decision

| Area | Evidence | Decision |
| --- | --- | --- |
| Automated source, test, docs and static-release validation | [GitHub Actions: latest main](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml) | Check that the **exact candidate SHA** is green |
| Reproducible candidate ZIP and SHA-256/provenance | CI package step and `BUILD_INFO.json` / `SHA256SUMS.txt` | Candidate packaging only |
| Real Chromium popup, dashboard, accessibility and keyboard | [Acceptance record](ACCEPTANCE.md) | **Pending** |
| Live Binance Futures REST, WebSocket and feed recovery | [Acceptance record](ACCEPTANCE.md) | **Pending** |
| Depth sequence-gap/snapshot recovery | [Acceptance record](ACCEPTANCE.md) | **Pending** |
| MV3 suspension, multi-tab locks, notification permissions | [Acceptance record](ACCEPTANCE.md) | **Pending** |
| Recording/replay isolation and sustained load | [Acceptance record](ACCEPTANCE.md) | **Pending** |
| Existing-install data and settings migration | [Acceptance record](ACCEPTANCE.md) | **Pending** |
| Store screenshots, permissions and privacy statements | [Store assets](../STORE_ASSETS.md) | **Pending** |

The pending release gate template lives in [`release-acceptance.json`](release-acceptance.json). Final signoff is supplied as a separate, commit-bound evidence file via `RELEASE_ACCEPTANCE_FILE`; see [acceptance instructions](ACCEPTANCE.md). A check is not passed without real, reproducible evidence. Historical v1.22.0 notes and older CI results do not represent approval for the integrated candidate.

## Candidate build

**Prerequisite:** Node.js 20+ and npm. CI uses Node.js 22.

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
```

The resulting `dist/` directory contains:

| File | Purpose |
| --- | --- |
| `btc-live-chromium-v1.22.0-candidate.zip` | Runtime-only Manifest V3 test build |
| `SHA256SUMS.txt` | Verifiable SHA-256 checksum of the candidate ZIP |
| `BUILD_INFO.json` | Manifest version, source SHA when available, artifact size/checksum and candidate status |

GitHub Actions verifies archive integrity, deterministic re-packaging, metadata and checksum agreement, then uploads the package with its provenance files. Download the **latest successful exact-SHA** artifact from [Actions](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml). Extract the extension ZIP to a folder before **Load unpacked**; do not select the ZIP directly. Use a separate browser profile for candidate testing.

## Stable-release gate

```bash
npm run release:gate
```

The command must remain **non-zero** while any mandatory acceptance is pending, evidence is absent, the signoff is missing, or the recorded source commit/version differs. Passing this metadata gate still requires a reviewer to inspect the actual test evidence and packaged extension.

### Promotion steps (only after all gates pass)

1. Freeze the source SHA and verify the complete automated suite on that exact checkout.
2. Test the actual unpacked candidate and live Binance endpoints across the complete [acceptance matrix](ACCEPTANCE.md).
3. Record UTC evidence and reviewer in an **external** approval record bound to the tested source SHA (do not edit that SHA into the same commit). Confirm the source, build and signoff correspond.
4. Decide the customer-visible version; consistently update `manifest.json`, package metadata, changelog, release notes and store listing. **Do not imply v16 is a shipped version until it is approved.**
5. Rebuild from the intended release SHA, compare checksums, inspect package contents and verify the required permissions and local assets.
6. Prepare **actual screenshots from the approved extension**, test the upgrade path, verify privacy disclosures and keep rollback artifacts.
7. Create a version tag and publish a GitHub release only for an accepted build; separately submit the reviewed package/listing to the Chrome Web Store and track its review state.

Never overwrite historical tags or use a candidate name as evidence that a store version is already live.

## Historical version distinctions

- `1.22.0` is the repository manifest and a historical release-notes label, **not** proof that this candidate was published to the store.
- `v16 Phase 01–10` describes a development milestone, **not** a release semver.
- The [historical v1.22.0 notes](../GITHUB_RELEASE.md), [old release checklist](../RELEASE_CHECKLIST.md) and [Phase 10 notes](PHASE10.md) retain their original context.
- `main` is the single maintained integration branch; the legacy branch is described in [repository policy](REPOSITORY.md).

[README](../README.md) · [Testing](TESTING.md) · [User guide](USAGE.md) · [Security](../SECURITY.md)
