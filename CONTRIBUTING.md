# Contributing to BTC Live

BTC Live is a local-first Chromium Manifest V3 application consuming public BTCUSDT Binance Futures data. The maintained integration branch is **`main`**. Current source is a **development candidate** (manifest `1.22.0`) and has not completed customer-release approval.

## Prepare a change

1. Read the [README](README.md), [technical architecture](docs/ARCHITECTURE.md), [testing strategy](docs/TESTING.md) and [branch policy](docs/REPOSITORY.md).
2. Pin the current Git SHA. Reproduce or precisely define the intended behavior and relevant failure path.
3. Keep the patch small, reversible and compatible with the runtime, storage and MV3 model. Avoid speculative dependency additions or version bumps.
4. Do not remove validation, replay/live separation, trust-boundary enforcement, safe notification failure handling or least-privilege browser permissions.
5. Add deterministic tests for the original problem and adjacent malformed, stale, unauthorized (where applicable) and legitimate paths.

## Verify locally

Requires **Node.js 20+** and npm. From the root:

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
```

Review the entire Git diff before committing. Ensure the package contains only intended runtime files and no secrets, user data or test fixtures.

## Keep documents in sync

Update README/user steps for visible behavior, architecture for interface/data-flow changes, security/privacy for altered permissions/storage/networks, and release documentation for material changes. Do not change extension semver, create tags or claim customer readiness without the [release procedure](docs/RELEASE.md).

## Review and maintainership

- Use the [pull-request template](.github/pull_request_template.md) with an exact SHA and observed checks.
- The default `main` branch is the maintained source; unrelated changes must not be merged into a release candidate.
- CI verifies source/build constraints. Real browser/live Binance, notification, migration, performance and store acceptance are **additional**, manual requirements.
- Route ordinary bugs through [Support](SUPPORT.md) and sensitive vulnerabilities through [Security](SECURITY.md).

The project is MIT licensed. Contributions must respect upstream licensing and third-party trademarks.
