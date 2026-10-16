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
  The default per-test-file timeout is **20 seconds**. For slower runners, set `BTC_LIVE_TEST_TIMEOUT_MS` to an integer from `1000` through `300000` (milliseconds); invalid values fail immediately. This does not change the independent 10-second JavaScript syntax-check timeout. Example: `BTC_LIVE_TEST_TIMEOUT_MS=60000 npm run verify` (PowerShell: `$env:BTC_LIVE_TEST_TIMEOUT_MS='60000'; npm run verify`).
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

### Full-interface DOM regression harness

```bash
# Optional local developer dependency; not included in the extension runtime.
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:ui
```

`test:ui` starts an ephemeral loopback server and launches Chromium through Playwright. All external HTTP and WebSocket traffic is intercepted. Deterministic synthetic REST fixtures, idle sockets and a mock browser-storage API exercise the actual popup/dashboard modules without contacting Binance or creating native notifications. Mock preferences live only in the isolated browser context and are discarded on exit.

Coverage includes all six workspaces at 320/390/560/800/1024/1440/1920px, page overflow, navigation keys, density across market repaints, command filtering/selection/dismissal/focus return, focus mode, native chart modal isolation/restoration and a 320×568 viewport, reference-price disclosure, target create/pause/remove, duplicate submit prevention, failed target/history writes, notification-test outcomes, popup settings and offline rendering. It also checks Analytics filter/keyboard isolation, event record/stop/save/load/delete using isolated IndexedDB, and sample record/stop/clear. Imported/saved replay remains explicitly unverified and offline. `CHROMIUM_PATH` optionally selects an installed executable; `UI_SCREENSHOT_DIR` optionally saves local QA screenshots. These screenshots contain **synthetic prices**, not live observations. DOM geometry checks and visual review do not certify all accessibility requirements, live streams or installed-extension behavior.

### Chromium CI DOM evidence

The separate `chromium-ui-dom` job in `.github/workflows/verify.yml` installs a pinned Playwright developer dependency and its Chromium browser on an isolated Linux runner. It executes `npm run test:ui` using only intercepted, synthetic data and uploads the console log and available viewport screenshots as the `chromium-ui-dom-evidence` artifact, including on failure. A failed job blocks ordinary CI integration; a passing job is **Tier 2 synthetic browser evidence only**.

The test intentionally does not load the actual MV3 extension, validate real Binance streaming, certify visual snapshot baselines, or approve the `chromium-ui` manual release gate. Browser and artifact provenance are available from the matching GitHub Actions run; retain acceptance screenshots and independent reviewer signoff separately.

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

## GitHub software update checks

`tests/software-updates.test.js` covers semantic comparison, release eligibility, request deduplication, channel cache invalidation, transient retry throttling (including HTTP-date `Retry-After` responses), persistent state and failures. Manually verify real Chromium MV3 startup, installation lifecycle, worker suspension, parallel popup/dashboard views, GitHub API errors, notification permissions, channel switching and release-link handling. CI does not establish network availability or browser behavior. Do not promote a release merely because update discovery works.

## Candidate 1.24.0 regression focus

- `tests/feed-recovery.test.js` verifies depth-book candidate rejection, retained map references, duplicate price-level update order and overflow safety.
- `tests/render-scheduler.test.js` checks that a frame scheduled during a failed render is still delivered.
- `tests/websocket.test.js` rejects oversized combined market frames before JSON parsing.
- `tests/release-regression.test.js` prevents manifest/package version drift; UI command-palette modal isolation and textarea focus outlines still require browser acceptance.
- These Node checks do **not** establish real browser render performance, Binance feed integrity or manual release acceptance.

## Software Updates 1.24.1 regression coverage

The update tests now include installed-manifest version cache invalidation, validated storage-derived release links, malformed API responses, offline reporting, concurrent check/configuration serialization, and manual checks with automatic polling disabled. The UI distinguishes last successful check from last attempt, and explains why an unpacked development candidate is not an eligible published release. Actual MV3 worker restart, browser accessibility, network rate-limits, and installed-extension behavior remain manual acceptance requirements.

## Software Updates 1.24.2 verification

`tests/software-updates.test.js` now checks multi-page public release discovery, SemVer build-metadata equivalence, bounded pagination (five pages of 100 results), page-specific rate limiting, malformed later pages and the rule that incomplete release histories cannot be presented as definitive absence or currency. Network and browser behavior remain separate manual acceptance requirements.


Visual QA viewport coverage: the deterministic Chromium smoke checks all six dashboard workspaces at 320, 360, 390, 560, 800, 1024, 1440, 1920 and 2560 CSS px (54 combinations), captures representative screenshots, and checks consolidated 24h popup statistics at 320, 360, 390 and 408 px. Mock/HTTP DOM checks do not replace real installed-MV3 acceptance.


Installed-MV3 Chromium CI smoke: `node scripts/mv3-smoke.mjs` launches a real unpacked MV3 extension from the exact generated candidate ZIP during CI in headless Chromium, verifies extension origin/manifest and basic popup/dashboard controls, and captures popup and all six workspace screenshots plus observed DOM/load navigation timings as a local evidence baseline (not a before/after performance claim). It does not establish live Binance connectivity, lifecycle recovery, notifications, upgrade migration, release acceptance or human visual signoff. Evidence is retained as `chromium-mv3-installed-evidence`.
