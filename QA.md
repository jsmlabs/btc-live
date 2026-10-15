# BTC Live quality assurance

> [!IMPORTANT]
> **No real Chromium acceptance has yet been certified for the current candidate.** This worksheet is the active QA entrypoint; earlier version-specific instructions remain in the [historical QA archive](docs/HISTORICAL-QA.md).

## Test coverage and evidence

| Layer | How to verify | Evidence interpretation |
| --- | --- | --- |
| Static + deterministic Node | `npm run verify` | Syntax and unit/regression behavior only |
| Documentation + package | `npm run docs:check`, `npm run release:check`, package and checksum scripts | Internal links, manifest/resource policies, repeatable artifact |
| Simulated DOM | Optional Python/Playwright `scripts/browser-smoke.py` | Mock transport and chart behavior, **not live extension** |
| Real Chromium / Binance / migration | [Manual smoke worksheet](docs/SMOKE-TEST.md) | Required for actual customer approval |

## Candidate release QA

- [ ] Verify clean successful automated CI at the **exact intended final source SHA**.
- [ ] Install unpacked build in dedicated Chromium profile; inspect popup/dashboard, service worker and console.
- [ ] Exercise all available workspaces, command palette, drawing controls, responsive and keyboard states.
- [ ] Observe live Futures REST/WS startup, feed outage/recovery and depth snapshot gaps.
- [ ] Check stale metrics are suppressed rather than relabeled as zero or live.
- [ ] Verify standard and advanced notifications with permission allowed/denied, multi-tab/locks and MV3 sleep/restart.
- [ ] Confirm recording/replay import limits, isolation from live alert delivery and representative sustained-load behavior.
- [ ] Verify upgrade from the actual installed store version, saved settings and recovery/rollback.
- [ ] Compare final screenshots, support/privacy disclosures, metadata and source against the reviewed package.

Each case must include environment, precise steps, expected/actual result, timestamp, artifacts and reviewer. An unrun or inaccessible scenario is **BLOCKED**, never PASS.

## Final release decision

Seven required manual gates are enumerated in [Acceptance](docs/ACCEPTANCE.md). The tracked approval template deliberately remains pending. Human-reviewed evidence must be provided separately, bound to the exact Git SHA; `npm run release:gate` checks structure but not factual authenticity.

**Do not tag or publish a stable release until all these checks are complete.**

[Documentation index](docs/INDEX.md) · [Testing](docs/TESTING.md) · [Release checklist](RELEASE_CHECKLIST.md)
