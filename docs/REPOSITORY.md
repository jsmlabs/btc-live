# Repository and maintenance policy

## Maintained source of truth

| Item | Policy |
| --- | --- |
| Default maintained branch | **`main`** |
| Current integration | **Development candidate**, pending real-browser approval |
| Manifest version | `1.22.0` (not proof of store publication) |
| Automated validation | [GitHub Actions for main](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml) |
| Customer release | Blocked until the [acceptance matrix](ACCEPTANCE.md) passes |

`main` is the only intended long-lived integration branch. Temporary review branches are not permanent maintenance channels.

## Change procedure

1. Resolve the current `main` SHA, task requirements, affected files and existing behavior.
2. Make the smallest complete change without losing storage, feed, permission or browser-lifecycle invariants.
3. Add/repair deterministic tests for expected, malformed, stale, retry and regression scenarios.
4. Update affected README, architecture, user steps, privacy/security disclosures, scripts and release metadata **when behavior changes**.
5. Run `npm run verify`, `npm run docs:check`, `npm run release:check`, `npm run package:extension` and `npm run package:metadata`; inspect the package.
6. Review the final diff and only commit scoped changes; verify CI on that exact commit.
7. Do not create stable tags, publish ZIPs to customers or modify the Chrome Web Store until [manual release acceptance](ACCEPTANCE.md) is independently approved.

Use only the maintained scripts listed in [Release](RELEASE.md) for candidate verification and packaging. Current topics are organized in the [documentation index](INDEX.md).

[Contributing](../CONTRIBUTING.md) · [Support](../SUPPORT.md) · [Security](../SECURITY.md)
