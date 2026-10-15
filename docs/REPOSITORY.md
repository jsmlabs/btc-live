# Repository and maintenance policy

## Maintained source of truth

| Item | Policy |
| --- | --- |
| Default maintained branch | **`main`** |
| Current integration | v16 Phase 01–10 **development candidate** |
| Manifest version | `1.22.0` (not a claim of v16 publication) |
| Automated validation | [GitHub Actions for main](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml) |
| Customer release | Blocked until the [acceptance matrix](ACCEPTANCE.md) passes |

`main` is the only intended long-lived integration branch. Temporary review branches are not permanent maintenance channels.

**Historical exception:** `maintenance/v1.0.x` still exists as a legacy ref. Its Spot/Firefox-era assumptions are incompatible with the current Chromium Futures candidate. Do **not** merge/rebase that branch into `main` or force-push `main` to erase it. PR #1 has been closed unmerged; an administrator may delete the obsolete branch after confirming no history is needed.

## Change procedure

1. Resolve the current `main` SHA, task requirements, affected files and existing behavior.
2. Make the smallest complete change without losing storage, feed, permission or browser-lifecycle invariants.
3. Add/repair deterministic tests for expected, malformed, stale, retry and regression scenarios.
4. Update affected README, architecture, user steps, privacy/security disclosures, scripts, changelog and versions **when behavior changes**.
5. Run `npm run verify`, `npm run docs:check`, `npm run release:check`, `npm run package:extension` and `npm run package:metadata`; inspect the package.
6. Review the final diff and only commit scoped changes; verify CI on that exact commit.
7. Do not create stable tags, publish ZIPs to customers or modify the Chrome Web Store until [manual release acceptance](ACCEPTANCE.md) is independently approved.

The retired `scripts/build-store.mjs` and `scripts/runtime-files.mjs` are **not** valid current build commands; use [Release](RELEASE.md). Historical phase reports are retained for provenance only; consult the [documentation index](INDEX.md).

[Contributing](../CONTRIBUTING.md) · [Support](../SUPPORT.md) · [Security](../SECURITY.md)
