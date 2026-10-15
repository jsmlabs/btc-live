# Release and build guide

> [!IMPORTANT]
> **Development candidate - NOT approved for customer publication.** Current `main` contains the extension development candidate, while `manifest.json` reports `1.24.0`. A green CI badge does not change its release status.

## Release state

| Milestone | Status | Required proof |
| --- | --- | --- |
| Automated source and regression checks | Executed in GitHub Actions | Success on the **exact proposed commit** |
| Static permissions/CSP/resources check | Automated | Successful release check |
| Deterministic runtime-only candidate ZIP | Automated | Integrity, reproducibility, checksum and provenance |
| Actual Chromium MV3 popup/dashboard | **Pending** | Browser build, console, interaction outcomes |
| Live Binance feeds, reconnect and depth resync | **Pending** | Timestamped real-endpoint traces |
| Multi-tab alerts, MV3 suspension and OS permission denial | **Pending** | Repeatable lifecycle outcomes |
| Large recording/replay workload and stability | **Pending** | Load duration, hardware and measured budgets |
| Existing-install migration and rollback | **Pending** | Sanitized before/after state and rollback evidence |
| Store visuals, copy and privacy/security review | **Pending** | Approved final-build material |

The structured [acceptance checklist](ACCEPTANCE.md) is the source for **manual** gates, not a claim those tests have passed.

## Build a candidate

**Requirements:** Node.js 20+ and npm. CI runs Node.js 22.

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
```

| Artifact in `dist/` | Function |
| --- | --- |
| `btc-live-chromium-v1.24.0-candidate.zip` | Deterministic package of manifest and reviewed runtime directories |
| `SHA256SUMS.txt` | SHA-256 digest for the runtime ZIP |
| `BUILD_INFO.json` | Manifest version, candidate status, source SHA (when available) and artifact metadata |

The GitHub Actions workflow verifies syntax, unit tests, local-document links, manifest/HTML contracts, sorted ZIP contents and deterministic re-packaging. It uploads all three files in the **`btc-live-candidate-zip`** artifact. Select a successful workflow for the exact SHA; verify the hash before use. Extract the inner ZIP and use **Load unpacked** in a dedicated Chromium profile.

The candidate ZIP is **not** an approved stable store package. A successful checksum does not establish browser functionality.

## Stable acceptance: intentionally fail closed

```bash
npm run release:gate
```

Without external acceptance evidence, the command returns a non-zero exit code. The committed `docs/release-acceptance.json` is **a pending template**; final approval must be stored **outside the tracked source tree** to avoid the circular requirement of embedding a commit SHA into that same commit.

After real browser/migration/store testing, copy the template to a separate file, record all seven passed gates, evidence HTTPS links, exact commit, manifest version, reviewer and UTC timestamp, and run:

```bash
RELEASE_ACCEPTANCE_FILE=dist/release-approval.json npm run release:gate
```

PowerShell: `$env:RELEASE_ACCEPTANCE_FILE='dist/release-approval.json'; npm run release:gate`.

This validates **record structure and same-SHA binding**, not evidence authenticity. A responsible reviewer must inspect the actual results before publication. Do not edit or commit the approved record into the same SHA to which it refers.

## Promote an accepted customer release

1. Choose the approved release version; align manifest, package metadata, screenshots, release notes and store listing. Source metadata is not proof of an installed public version.
2. Freeze/test the final release commit; reconfirm automated success and all manual acceptance on that exact build.
3. Run the external release gate and review the underlying links/evidence; check for regressions after any final code or metadata edit.
4. Rebuild, inspect the actual extension archive, verify SHA-256, rights, capabilities and rollback artifacts.
5. Only then create the matching version tag and GitHub release. Store submission requires separate approval, review and proof of actual publication.

**Never treat merging, tagging, a draft store listing, or passing static checks as proof of a released extension.**

[Release checklist](../RELEASE_CHECKLIST.md) · [Testing](TESTING.md) · [Documentation index](INDEX.md)

## Software-update discovery

The extension reads official published GitHub Releases; the `main` branch and candidate CI artifacts never imply release approval. Only after the existing manual acceptance process may a stable GitHub Release be published. Version tags must correspond to the actual installed manifest version. Discovery does not install software. The GitHub Releases API is a new declared read-only host permission.
