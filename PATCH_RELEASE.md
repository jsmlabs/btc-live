# Patch Release Runbook

This runbook applies only to BTC Live v1.0.x maintenance releases.

## Release gate

Do not create a patch release unless at least one of the following exists:

- A reproducible bug in existing v1.0.x behavior
- A browser compatibility regression
- A Binance public market-data compatibility issue
- A security defect
- A Chrome Web Store policy or packaging requirement that requires a code or metadata change

Feature requests must not be included in v1.0.x.

## Branching

1. Keep `main` aligned with the currently released or submitted stable version.
2. Work from `maintenance/v1.0.x`.
3. Create a short-lived fix branch when the change is non-trivial:
   `fix/<short-description>`.
4. Merge only after the defect is reproduced and the fix is verified.

## Required patch contents

A shipping patch must include:

- Minimal source change
- Regression test when practical
- CHANGELOG.md entry
- PATCH version bump in package.json and manifests through the existing build path
- Successful `npm run verify`
- Successful Chromium and Firefox package generation

## Version rule

Only PATCH increments are allowed in this maintenance line.

Examples:

- 1.0.0 -> 1.0.1
- 1.0.1 -> 1.0.2

Do not ship feature work under a patch version.

## Pre-release verification

Before tagging:

1. Confirm the original defect is reproducible on the previous version.
2. Confirm the same reproduction passes with the patch.
3. Run:
   `npm run verify`
4. Inspect the generated Chromium and Firefox ZIPs.
5. Confirm permissions did not expand unintentionally.
6. Confirm no remote code, tracking, analytics, ads, or backend dependency was added.
7. Confirm user-facing extension copy remains English.

## Release

After verification:

1. Merge the verified patch into `main`.
2. Confirm `main` is clean and CI is green.
3. Create annotated tag `v1.0.x`.
4. Push the tag.
5. Create the GitHub release.
6. Attach Chromium and Firefox ZIPs.
7. Submit the Chromium ZIP as a Chrome Web Store update.
8. Do not start another patch until the submitted source is reproducible from Git.

## Rollback

If a patch introduces a regression:

- Do not stack speculative fixes.
- Reproduce the regression.
- Prefer reverting the offending change or issuing the smallest corrective patch.
- Preserve the previous stable tag and release artifacts.
