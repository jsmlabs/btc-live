# Customer-release acceptance

**Current decision: BLOCKED / NOT YET APPROVED.** The automated build can be generated, but no complete real Chromium/live-feed/migration/store evidence set is recorded. Passing source tests is necessary and **not sufficient**.

## Required gates

The CLI [`release-gate.mjs`](../scripts/release-gate.mjs) defines these seven exact IDs. Keep the IDs unchanged in the external acceptance JSON.

| Gate ID | Actual test requirement | Evidence |
| --- | --- | --- |
| `chromium-ui` | Load built MV3 extension, popup and all workspaces; check keyboard, responsive layout, chart gestures and console | Browser/OS/build, steps, screenshots and console log |
| `live-binance-feeds` | Public Binance Futures startup, stale/drop/reconnect, independent REST/WS degradation | Timestamped traces, network/state transition results |
| `depth-recovery` | Delayed snapshots, delta sequence gaps, crossed book rejection and valid resync | Controlled gap and book state evidence |
| `mv3-alert-lifecycle` | Worker suspension/restart, alarms, notifications denied/allowed, two dashboards and Web Locks | Timestamped trigger, permission and lifecycle logs |
| `recording-replay-load` | Real capture/replay/import validation, alert isolation, sustained performance | Session fixtures, load duration, resource traces |
| `existing-install-migration` | Upgrade from actual installed version and preserve supported state; rollback | Sanitized before/after settings, observed migration outcome |
| `store-assets-privacy` | Real final-build captures, permissions, privacy and accurate listing copy | Reviewed screenshots, declaration and package references |

**Report each case** with exact SHA, artifact checksum, UTC timestamp, browser version, test machine, reproducible steps, expected and actual results, reviewer and stable evidence URLs. Redact any unrelated private data.

## Automated checks vs acceptance

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
```

These prepare the development package only. Do not mark the manual gates as passed because the commands succeed or because the Playwright mocked DOM smoke test passes.

## Approved evidence file - kept separate from source

[`release-acceptance.json`](release-acceptance.json) is a **tracked pending template**. When real manual checks are complete, copy it to an external file such as `dist/release-approval.json`, then set:

- `schema_version` to `1`, `manifest_version` to the actual version and `commit` to the full **40-character tested Git SHA**.
- `decision` to `approved` only after all checks pass; identify `approved_by` and ISO 8601 UTC `approved_at`.
- Each expected gate to `status: "passed"` with one or more HTTPS `evidence` URLs.

Run the structural gate **in the exact clean checkout**:

```bash
RELEASE_ACCEPTANCE_FILE=dist/release-approval.json npm run release:gate
```

PowerShell: `$env:RELEASE_ACCEPTANCE_FILE='dist/release-approval.json'; npm run release:gate`.

The gate rejects a missing/mismatched source SHA, uncommitted tracked changes, invalid approval, failed/missing gate or absent evidence reference. It **cannot inspect whether a referenced screenshot, trace or result is truthful**. Human signoff is therefore mandatory. The approval file must remain external to the tested commit: otherwise editing the SHA into that commit changes the SHA itself.

After any code/version or material packaging change, obtain a new exact-build acceptance. No automated process may silently promote this candidate.

[Release guide](RELEASE.md) · [Browser worksheet](SMOKE-TEST.md) · [Store assets](../STORE_ASSETS.md)
