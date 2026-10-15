# Repository maintenance and branch policy

## Source of truth

- **Maintained branch:** `main`, also the default branch.
- **Current code:** v16 Phase 01–10 development candidate, with `manifest.json` reporting `1.22.0`.
- **Release:** not production-approved; [acceptance gates](RELEASE.md) remain open.

`main` is the only **intended long-lived integration branch**. Avoid permanent maintenance and release branches. Temporary review branches or forks, when needed, should be removed after review. Branch-protection availability and restrictions must be verified separately in GitHub settings; a passing CI workflow is not a substitute.

## Legacy v1.0.x branch

The old `maintenance/v1.0.x` branch and [PR #1](https://github.com/jsmlabs/btc-live/pull/1) diverged from the current source. Their historical Spot, Firefox and package-version assumptions are incompatible with the current Futures/MV3 candidate. **Do not merge or rebase them into `main`.** Reusable reporting and contribution practices were adapted into current files.

Closing the obsolete PR does **not** remove its branch. A repository owner must separately delete the obsolete ref after preserving any needed commit history. Do not rewrite or force-push `main` just to reduce branch count.

## Maintenance procedure

1. Establish exact `main` SHA, release state and affected behaviors.
2. Make small, reviewable, risk-aware changes with failure-path tests.
3. Keep README, documentation, security/privacy assumptions, changelog and CI consistent.
4. Run `npm run verify`, `npm run docs:check`, `npm run release:check` and `npm run package:extension`; confirm CI on the resulting SHA.
5. Preserve the distinction between deterministic source tests and **unverified** Chromium, live-feed, MV3 lifecycle, storage migration and load tests.
6. Do not tag, publish or promote a candidate before the [release gates](RELEASE.md) pass.

The old standalone `scripts/build-store.mjs` and `scripts/runtime-files.mjs` path is superseded by the checked, reproducible `npm run package:extension` candidate pipeline. Old historical release notes are retained as historical evidence, not active build instructions.

[README](../README.md) · [Contributing](../CONTRIBUTING.md) · [Support](../SUPPORT.md) · [Tests](TESTING.md) · [Security](../SECURITY.md)
