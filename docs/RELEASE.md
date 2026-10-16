# Release and build guide

> [!IMPORTANT]
> **Development candidate - NOT approved for customer publication.** Current `main` contains the extension development candidate, while `manifest.json` reports `1.25.0`. A green CI badge does not change its release status.

## Development-candidate changes in 1.25.0

- Expose a release's official SHA-256 checksum-manifest link next to a validated extension ZIP, with independent same-release asset validation and cached URL sanitization.
- Provide regression coverage for checksum asset integrity metadata, malformed or duplicate assets and the software-update panel's download controls.
- Preserve manual unpacked installation, existing Stable release acceptance gates, and the explicitly untested Experimental Preview path. Download links do not perform or prove file integrity checks automatically.

## Development-candidate changes in 1.24.2

- Read multiple bounded GitHub Releases API pages so a stable release cannot be silently hidden by many recent preview releases.
- Reject incomplete or malformed release histories rather than reporting an unsupported or up-to-date state from partial evidence.
- Accept SemVer build metadata in release tags while comparing version precedence correctly.
- Add pagination, rate-limit, truncation and version-precedence regressions. No new permissions, auto-install mechanism or stable-release approval.

## Development-candidate changes in 1.24.1

- Invalidate stale update cache results when the installed extension manifest version changes.
- Treat malformed GitHub API responses as check failures instead of reporting no eligible release.
- Serialize update checks and settings writes; distinguish offline errors and sanitize storage-derived release links in the UI.
- Explain unpacked development-candidate upgrades, improve check feedback and preserve Stable/Preview release eligibility rules.
- Add deterministic regression tests while retaining all seven pending manual acceptance gates.

## Development-candidate changes in 1.24.0

- Avoid full order-book copies for incremental depth diff validation while preserving fail-closed candidate rejection.
- Preserve render-scheduler redraw requests across rendering exceptions and bound combined WebSocket payload parsing.
- Isolate the command-palette shortcut from other open dialogs and expose textarea keyboard focus.
- Add deterministic regression coverage and bind the private build package version to the extension manifest.
- No new extension permissions, trading capability, API-key access or stable-release approval.

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
| `btc-live-chromium-v1.25.0-candidate.zip` | Deterministic package of manifest and reviewed runtime directories |
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

## Repository configuration for distribution

The GitHub repository must remain public if the extension is to discover releases through the unauthenticated GitHub Releases API. Source commits, tags, and Actions candidate artifacts are not installable published updates.

Before enabling public distribution, an administrator should establish branch protection or a repository ruleset for `main`: require pull-request review as appropriate, passing verification checks on the exact commit, and prevent force pushes and branch deletion. Configure Actions permissions using least privilege; the candidate verification workflow intentionally uses `contents: read`. Release publishing requires a separately scoped, approved process and must not be enabled merely to make the update panel display a new version.

To make an update discoverable, complete all seven manual release-acceptance gates for the exact build, obtain documented approval, verify the reproducible package and checksum, and only then publish an appropriately tagged GitHub Release with a compatible downloadable extension archive and release notes. Stable and Preview must accurately match the release prerelease metadata and version tag. Confirm through the unauthenticated Releases API that the intended release is actually published.

For an unpacked extension, use the [source installation guide](../README.md#get-started), replace or refresh its local source, and reload it via `chrome://extensions`. Chrome cannot silently rewrite an unpacked extension directory. A browser-store installation updates through the browser/store rather than through this GitHub checker. Reloading alone does not fetch repository changes.

## Explicit untested Preview publication

The manual [experimental preview workflow](../.github/workflows/publish-experimental-preview.yml) is separate from approved Stable publication. From the **main** branch, the publisher must explicitly enter `PUBLISH_UNTESTED_PREVIEW` in a manual Actions dispatch. It packages a development candidate with checksum/provenance but intentionally skips automated acceptance tests and all seven manual Stable acceptance gates. GitHub marks the result as a **prerelease**, titled **EXPERIMENTAL / UNTESTED**, and the release notes disclose the missing real-world verification. It never uses the `production-release` environment or `RELEASE_ACCEPTANCE_JSON`. Access to manual workflow dispatch and `contents: write` remains security-sensitive and must be restricted by repository permissions.

When Preview is selected, the Software Updates panel presents a published `v<manifest>-preview.<run-id>` release for the same installed manifest version as **Experimental download available**, not as a newer installed version. The link opens the release for manual inspection/download; no automatic installation occurs. Stable excludes these experimental prereleases. Older previews and unrelated prerelease identifiers are not advertised as same-manifest experimental downloads.

The tag is `v<manifest-version>-preview.<workflow-run-id>`. The archive still contains the unchanged numeric manifest version and is intended only for manual unpacked installation in a disposable profile. **Do not represent that tag as a newer installed version**: SemVer treats it as older than the same stable manifest version, so the existing update checker may intentionally not show an upgrade for an installation already at that version. Stable releases remain subject to the separate approved workflow and all seven gates. A Preview release is not Chrome Web Store publication or automatic installation.

## Manual approved GitHub Release publication

The workflow [Publish Approved BTC Live Release](../.github/workflows/publish-approved-release.yml) is a manual `workflow_dispatch` pipeline on `main`; it does **not** run on commits, tags, or pull requests. It requires the separate GitHub Actions environment named `production-release` with required reviewers and an environment secret `RELEASE_ACCEPTANCE_JSON` containing the externally approved acceptance document for the **exact current main commit**. Keep that secret inaccessible to untrusted pull requests and rotate/update it for each approved release.

Before triggering, verify the source commit and all seven real-browser, Binance, recording, migration, privacy and store acceptance gates with actual evidence. Configure the environment's deployment protection and reviewer requirements in GitHub Settings. Dispatch using a `v<manifest-version>` tag on `main`. The workflow fails closed without an approval record, on version/SHA mismatch, or when the release/tag exists; it reruns source, documentation, static release, packaging and checksum checks before publishing three assets. Publication uses an explicitly scoped `contents: write` token only inside the protected job. After publishing, verify the actual GitHub Release and its assets. A published GitHub ZIP is a **manual unpacked-installation artifact**, not a Chrome Web Store package or self-installing update. Existing candidate archive naming stays explicit in the release notes and metadata.

Do not configure or trigger the workflow solely to make Software Updates display an update. A repository administrator must establish the protected environment and approve each actual release. Repository branch protection and a successful workflow for the exact commit are separate requirements.

When a published eligible release contains exactly one uploaded, size-bounded archive named `btc-live-chromium-v<manifest-version>-candidate.zip` at its canonical GitHub Releases download URL, the panel displays **Download Extension ZIP** alongside release notes. An absent, duplicated, oversized, incomplete or foreign asset does not generate a download action. Downloading the ZIP never constitutes installation; checksum verification, extraction and manual loading remain the user's responsibility. When the same release also publishes exactly one small, uploaded `SHA256SUMS.txt` at its official GitHub Releases asset URL, the panel displays **SHA-256 Checksums** alongside the ZIP. The user must independently compare the ZIP digest against the manifest; a visible checksum link is not proof of a matching downloaded archive.

When the installed manifest version exceeds the most recent eligible published release, the panel displays **Installed version is newer** rather than claiming a normal up-to-date published installation. This may occur for unpacked development builds.

When there is no eligible published release, the update service additionally reads the public `main` branch manifest through GitHub's read-only Contents API. If its numeric version exceeds the installed version, the panel reports **Newer development source available** with an official source/upgrade guide, explicitly not a published release or automatic installation. Failed or malformed optional source lookups do not falsely claim a release. Replacing local files and reloading the unpacked extension remains a separate manual step.

## Software-update discovery

The extension reads official published GitHub Releases; the `main` branch and candidate CI artifacts never imply release approval. Only after the existing manual acceptance process may a stable GitHub Release be published. Version tags must correspond to the actual installed manifest version. Discovery does not install software. The GitHub Releases API is a new declared read-only host permission.
