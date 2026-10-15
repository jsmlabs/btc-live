# Testing and verification

BTC Live verification has **three independent tiers**. A green result at a lower tier does not imply acceptance of the next.

| Tier | Test environment | Covered | Not covered |
| --- | --- | --- | --- |
| 1. Static and Node | GitHub Actions / local Node 20+ | Syntax, modules, deterministic behavior, docs links, manifest constraints | Real browser behavior |
| 2. Optional DOM smoke | Python Playwright + Chromium, mocked WebSocket | Selected chart rendering, UI and simulated reconnection | Extension MV3 lifecycle, live exchange |
| 3. Real acceptance | Unpacked built extension in real Chromium, live Binance and prior installed version | User-facing behavior, connectivity, MV3 races and migration | Only the recorded scenarios/platforms |

## Developer commands

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
```

- **`verify`** checks JS syntax/imports and runs discovered `tests/*.test.js` separately, including timeout and failure reporting.
- **`docs:check`** verifies local Markdown link and embedded HTML paths. It does not verify remote site availability.
- **`release:check`** enforces a static MV3 manifest/permission/CSP/resource contract. It does **not** build/approve a store release.
- **`package:extension`** builds the sorted deterministic candidate ZIP, verifying source unless `--skip-verify` is explicitly supplied.
- **`package:metadata`** records SHA-256 and source provenance for the existing candidate ZIP.

CI also checks ZIP integrity, path exclusions, fixed timestamps, repeat-build byte-for-byte matching and checksum agreement. Use the workflow of the **specific tested commit**. Never count a queued, cancelled or superseded run as passed.

### Optional browser mock harness

```bash
python scripts/browser-smoke.py
```

Requires separately installed Python Playwright and Chromium. The test uses an **in-page synthetic WebSocket**, not the installed Manifest V3 extension or actual Binance connectivity. Passing it is browser DOM smoke evidence **only**.

## Real-browser acceptance matrix

Use [`SMOKE-TEST.md`](SMOKE-TEST.md) and [`ACCEPTANCE.md`](ACCEPTANCE.md), recording for each case: UTC time, exact SHA and package digest, OS/browser version, source fixtures or live endpoints, actions, expected/actual outcome, relevant console/trace and reviewer.

| Scenario | Essential observations |
| --- | --- |
| Extension and navigation | Manifest loads, worker initializes, popup/dashboard and six workspaces operate |
| UI/accessibility | Responsive widths, chart pointer and keyboard behavior, focus and layouts |
| REST and streaming | Feed startup, endpoint failure, reconnect, stale gating and recovery |
| Depth/trade integrity | Snapshot race, sequence gaps, late data and flow-window validity |
| Standard and advanced alerts | Enabled/denied notifications, cooldown, multiple tabs, Web Locks and dashboard closure |
| MV3 lifecycle | Worker suspension/restart, alarms and browser relaunch |
| Recordings/replay | Real storage, import limits, timeline seeking and no replay notifications |
| Load and compatibility | Prolonged CPU/memory/frame monitoring and existing-install migration |
| Distribution | Final screenshots, package permissions, privacy and store claims align |

**Failure rule:** An unrun, unavailable or inconclusive check is *pending*, not passed. Automated mocks cannot approve live acceptance. Record regressions, fix the root cause, then retest the original case and adjacent legitimate/failure paths.

## Release gate

The external, same-commit approval procedure is described in [Release](RELEASE.md). The committed pending acceptance JSON is an example of **missing evidence**; `npm run release:gate` should fail until independent signoff exists.

[Architecture](ARCHITECTURE.md) · [Release checklist](../RELEASE_CHECKLIST.md) · [Documentation index](INDEX.md)
