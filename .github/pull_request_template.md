## Problem and scope

Link a reproducible issue or explain the confirmed objective, observed behavior and required outcome.

## Change summary

Describe the minimal fix, affected interfaces and data contracts, and any documentation or release metadata updates.

## Verification

- [ ] `npm run verify`
- [ ] `npm run docs:check`
- [ ] `npm run release:check`
- [ ] `npm run package:extension`
- [ ] Relevant regression and failure paths reviewed
- [ ] Impacted README/guides/changelog updated

Give the **exact tested commit SHA** and concrete results. Leave unexecuted checks unchecked.

## Security, compatibility and release boundaries

- [ ] Permissions, CSP, credentials and no-trading boundary preserved
- [ ] Feed freshness/depth validation and live-alert/replay isolation preserved
- [ ] Storage and MV3 lifecycle impacts considered
- [ ] Browser/live-feed/multi-tab/migration/load acceptance gaps explicitly stated
- [ ] No unsupported stable-release or store-publication claims

Refer to [CONTRIBUTING.md](CONTRIBUTING.md) and [release gates](docs/RELEASE.md). `main` is the only maintained integration branch.
