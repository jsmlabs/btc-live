# Documentation guide

This index distinguishes **current instructions**, **candidate-release evidence** and **historical engineering records**. Do not infer publication from source-code integration or from a successful CI run.

## Start here

| Need | Authoritative current document |
| --- | --- |
| What BTC Live does; quick install | [README](../README.md) |
| Install, workspaces, keyboard and troubleshooting | [User guide](USAGE.md) |
| Runtime modules and trust boundaries | [Architecture](ARCHITECTURE.md) |
| Background vs dashboard-only alerts | [Alert contract](ALERTS.md) |
| Build, tests and reproducibility | [Testing](TESTING.md) |
| Release gates and version policy | [Release readiness](RELEASE.md) |
| Exact-commit acceptance and evidence | [Acceptance](ACCEPTANCE.md) |
| Current branch and maintenance policy | [Repository](REPOSITORY.md) |
| Privacy and user data | [Privacy policy](../PRIVACY.md) · [Data details](PRIVACY.md) |
| Security and vulnerability reporting | [Security policy](../SECURITY.md) |
| Support, fixes and contributions | [Support](../SUPPORT.md) · [Contributing](../CONTRIBUTING.md) |
| Customer-facing distribution | [Store listing draft](../STORE_LISTING.md) · [Store asset plan](../STORE_ASSETS.md) |
| Version history and provenance | [Changelog](../CHANGELOG.md) |

## Manual validation

Use the [browser smoke worksheet](SMOKE-TEST.md), [release checklist](../RELEASE_CHECKLIST.md), and the structured [pending acceptance template](release-acceptance.json). Only actual test evidence against the intended build can close a manual release gate.

## Historical engineering archive

The following files describe **what was recorded at an earlier phase**. They are not up-to-date runbooks or proof of a customer release.

| Stage | Record |
| --- | --- |
| Baseline | [Phase 01](BASELINE.md) and [source file hashes](baseline.json) |
| Feed integrity | [Phase 02](PHASE02.md) |
| Observability | [Phase 03](PHASE03.md) |
| Order flow | [Phase 04](PHASE04.md) |
| Chart interactions | [Phase 05](PHASE05.md) |
| Terminal UX | [Phase 06](PHASE06.md) |
| Replay | [Phase 07](PHASE07.md) |
| Alerts | [Phase 08](PHASE08.md) |
| Security/performance | [Phase 09](PHASE09.md) |
| Candidate engineering | [Phase 10](PHASE10.md) |
| Historical release | [Old checklist](HISTORICAL-RELEASE-CHECKLIST.md) · [v1.22.0 notes](../GITHUB_RELEASE.md) |
| Earlier investigations | [Hardening](../HARDENING.md) · [Performance](../PERFORMANCE.md) · [Archive integration](../ARCHIVE_INTEGRATION.md) |

**Source authority:** current `main` implementation and [manifest](../manifest.json) > current documentation > historical records. Browser/store reality must be separately verified.

