# Release acceptance record

The file [`release-acceptance.json`](release-acceptance.json) is a machine-readable **blocking release gate**. It is deliberately `pending`: a reproducible package and green automated CI are not proof of a production-ready Chromium extension.

## Required acceptance

| ID | Manual acceptance | Evidence to attach |
| --- | --- | --- |
| `chromium-ui` | Actual unpacked Manifest V3 popup/dashboard, interactions, keyboard, responsive display | Browser/OS/build, screenshots, console and test steps |
| `live-binance-feeds` | Live Binance Futures REST/WS startup, stale/dropout and reconnection | UTC feed/reconnect traces with timestamps |
| `depth-recovery` | Missing/delayed snapshot, sequence gaps and resynchronization suppress invalid metrics | Gap and snapshot event evidence |
| `mv3-alert-lifecycle` | Worker suspension, browser restarts, notification denial, multiple tabs, dashboard-closed limitations | Timestamped alarm, permission, trigger and notification logs |
| `recording-replay-load` | Recording coverage, import rejection, replay isolation and representative sustained performance | Fixture/results, browser metrics, workload and duration |
| `existing-install-migration` | Actual upgrade path from the installed release preserves supported stored data/settings | Sanitized before/after fixtures and expected migration contract |
| `store-assets-privacy` | Screenshots of tested packaged UI, privacy disclosures, permissions and store listing match the artifact | Reviewed asset links and package/store metadata |

For each scenario, record the exact source commit, manifest version, platform/browser build, steps, expected result, actual outcome, UTC time and stable evidence links. Redact user data and secrets.

## Commands

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
npm run release:gate
```

The first five prepare and verify a **candidate**. The last command must fail while any gate is pending, missing, or recorded against another commit. It checks completeness and evidence references; it cannot establish authenticity of reports or substitute for an actual human review.

After acceptance, approve all scenarios in `release-acceptance.json` with real evidence, exact source SHA, approver and UTC approval time. **Important:** A commit modifying this record changes the source SHA; sign off the actual final tested commit and do not subsequently alter it without retesting and re-approval. When the stable release source is approved, reconcile version identifiers, tags, store assets, notes, and the rollback package in [Release readiness](RELEASE.md). Do not promote the candidate ZIP automatically.

[Testing](TESTING.md) · [Release status](RELEASE.md) · [Store assets](../STORE_ASSETS.md)
