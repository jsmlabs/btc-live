## Purpose and behavior

Explain the observed problem or requested feature, expected result, scope, reproduction, affected interfaces and failure modes.

## Implementation

Summarize changed paths, key design decisions, storage/API/permission impacts, compatibility and any reversible migration.

## Verification at the exact source SHA

- [ ] `npm run verify`
- [ ] `npm run docs:check`
- [ ] `npm run release:check`
- [ ] `npm run package:extension`
- [ ] `npm run package:metadata`
- [ ] Original problem and relevant failure/regression paths checked
- [ ] README, user guides, security/privacy and changelog reconciled as applicable
- [ ] Final diff inspected for unrelated changes, secrets and package drift

**Tested SHA:** `<full commit>`

**Observed results:** Provide concrete outcomes and links. Leave skipped/unavailable steps **unchecked**; do not claim browser acceptance from Node tests.

## Release and security boundaries

- [ ] External market data remains validated and stale/invalid dependencies fail closed.
- [ ] Least-privilege MV3 permissions, CSP and local-state security are preserved.
- [ ] Replay cannot trigger live alerts; notification-delivery semantics remain accurate.
- [ ] No stable release/tag/store claims without [manual acceptance](../docs/ACCEPTANCE.md).

[Contributing](../CONTRIBUTING.md) · [Documentation](../docs/INDEX.md) · [Release guide](../docs/RELEASE.md)
