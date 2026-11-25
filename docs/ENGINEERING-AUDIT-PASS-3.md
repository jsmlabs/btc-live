# Engineering audit — pass 3 (security and CI)

Date: 2026-11-25. Baseline: `bf5c454fdc582074fcf33a5f15b130a8cdc989e5`. Targeted review; not a complete security assessment.

| ID | Priority | Finding | Correction |
| --- | --- | --- | --- |
| AUD-11 | Medium | Ticker/trade normalizers implicitly convert boolean, array and whitespace values into numbers, including trade IDs and volume. | Accept only numbers and nonblank numeric strings; preserve legitimate zero. |
| AUD-12 | Medium | Removing cached update state leaves old release links and availability indicator visible until another successful render. | Sanitize absent state and clear old links immediately. |
| AUD-13 | Medium | Release gate checks tracked modifications but ignores untracked files, while runtime packager includes them, even ignored files. Exact-commit provenance is incomplete in a contaminated checkout. | Reject untracked/ignored files under the runtime package roots; allow external approval record under dist. |
| AUD-14 | High (CI blocker) | Browser installation fails on ubuntu-latest now running Ubuntu 26.04 with pinned Playwright 1.56.1. | Pin both Chromium jobs to ubuntu-24.04, keeping Playwright and browser coverage unchanged. |

## Evidence

PRs #62/#63/#64: native verify and Windows updater jobs passed on respective PR merge candidates (43 test files, zero failed in each). Both Chromium jobs failed during tooling installation, before smoke tests. Run IDs 45581066669, 45584396588, 45595111518. Error: Playwright does not support chromium on ubuntu26.04-x64.

AUD-11 and AUD-12 reproduce in isolated JS; regression cases pass after edits. AUD-13 new guard tested with injected Git adapter; actual local temporary Git repository confirms ls-files --others without exclude-standard includes ignored runtime files and excludes dist. Native full-suite and both browser jobs on this candidate pending. DNS prevents repository clone in this environment.

Manifest and exact CSP are already constrained; no new permissions or dependencies. Update discovery pins canonical repository release/asset URLs and uses noopener/noreferrer links. Security documentation corrected to include existing GitHub API permission. No automatic installation or publication performed. Release checksums are integrity metadata, not signatures or independent security proof.

Remaining: actual browser behavior, external sender/notification lifecycle, update distribution trust and repository protection settings, storage and performance review. No claim of live exchange security or complete audit.
