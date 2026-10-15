# Contributing to BTC Live

BTC Live is a local-first Chromium Manifest V3 market-monitoring extension. `main` contains the **v16 Phase 01–10 development candidate**; `manifest.json` still reports **1.22.0**. Integrated code is not necessarily production-approved.

## Before making changes

1. Read the [README](README.md), [architecture](docs/ARCHITECTURE.md), [test strategy](docs/TESTING.md) and [release gates](docs/RELEASE.md).
2. Establish the exact `main` commit, relevant browser build and expected behavior. Reproduce the observed defect before changing code.
3. Prefer the smallest robust fix. Preserve APIs, storage compatibility, permission boundaries, feed validity and unrelated behavior.
4. Add deterministic regression/failure-path tests when practical and update relevant documentation.
5. Record which checks were actually executed and distinguish simulated checks from real-browser or live-feed acceptance.

`main` is the only **maintained integration branch**. Do not merge the obsolete `maintenance/v1.0.x` line: it targets a different Spot-era product and Firefox build system. See [repository workflow](docs/REPOSITORY.md).

## Verification

Node.js **20+** (CI uses **22**). Loading the unpacked Chromium extension requires no npm install or build step.

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
```

The generated archive is a **development candidate**, not a production-approved release. CI passing does not establish Chromium UI correctness, live Binance availability, notification delivery, migration or long-session performance.

## Invariants

- Manifest V3; narrowly scoped permissions and CSP; no remote code, page injection, API keys, account access, tracking SDKs or order execution.
- Validate untrusted Binance REST/WebSocket events. Missing/stale market values are not zero; depth requires snapshot/sequence continuity.
- Replay never fires live alerts; advanced alert evaluation requires an open live dashboard and valid metrics.
- Respect MV3 worker suspension, background sampling, Web Locks coordination, notification failure and local storage limits.
- Avoid dependency additions, unnecessary architecture rewrites, unreviewed version bumps and unjustified performance or security claims.

Use the [PR template](.github/pull_request_template.md) and [bug report form](.github/ISSUE_TEMPLATE/bug_report.yml). Include issue, cause, implementation, tests, compatibility and residual risks. Redact secrets, local personal information and session exports. Consult [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md) for reporting channels.

Contributions are distributed under the [MIT License](LICENSE).
