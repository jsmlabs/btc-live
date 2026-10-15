# Documentation

BTC Live's documentation covers the **current development candidate**, its runtime contracts, test procedures and release criteria. An automated build does not establish customer-release approval.

## Product and operations

| Task | Document |
| --- | --- |
| Overview and quick installation | [README](../README.md) |
| Dashboard workspaces, chart controls and troubleshooting | [User guide](USAGE.md) |
| Runtime modules and trust boundaries | [Architecture](ARCHITECTURE.md) |
| Advanced and standard alerts | [Alert contract](ALERTS.md) |
| Local data and permissions | [Privacy policy](../PRIVACY.md) · [Implementation notes](PRIVACY.md) |
| Security and vulnerability reporting | [Security policy](../SECURITY.md) |
| Support and reproducible bug reports | [Support](../SUPPORT.md) |

## Development and verification

| Task | Document |
| --- | --- |
| Engineering conventions | [Contributing](../CONTRIBUTING.md) |
| Maintained branch and safe delivery | [Repository workflow](REPOSITORY.md) |
| Deterministic checks and test tiers | [Testing](TESTING.md) |
| Browser acceptance worksheet | [Smoke test](SMOKE-TEST.md) · [QA](../QA.md) |
| Security and reliability controls | [Hardening](../HARDENING.md) |
| Performance measurement requirements | [Performance](../PERFORMANCE.md) |

## Candidate build and publication

| Task | Document |
| --- | --- |
| Candidate ZIP, checksums and release procedure | [Release guide](RELEASE.md) |
| Manual gates and commit-bound signoff | [Acceptance](ACCEPTANCE.md) · [Pending template](release-acceptance.json) |
| Release checklist | [Release checklist](../RELEASE_CHECKLIST.md) |
| Chrome Web Store description draft | [Store listing](../STORE_LISTING.md) |
| Screenshots and branding requirements | [Store assets](../STORE_ASSETS.md) · [Asset inventory](../store-assets/README.md) |

**Source of truth:** actual manifest/runtime files and the exact tested Git commit for implementation; actual browser, exchange and store observations for release acceptance. Manifest version `1.22.0` alone does not establish publication status.
