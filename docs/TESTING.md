# Verification strategy

BTC Live separates three distinct evidence levels. A result in one level **never** certifies another.

| Level | Verified by | What it cannot prove |
| --- | --- | --- |
| **Static and deterministic** | Node syntax/import checks, unit/regression tests, manifest and local-document contracts | Runtime behavior in Chromium |
| **Simulated browser harness** | Optional `python scripts/browser-smoke.py` with Playwright/Chromium and mocked feed | Real extension MV3 lifecycle or real Binance network behavior |
| **Real acceptance** | Unpacked MV3 extension, live Binance traffic, actual browser interaction, load and migration evidence | Must be recorded independently; no shortcut via green CI |

## Automated verification

Node.js **20+**; GitHub Actions uses **22**. From repository root:

```bash
npm run verify
npm run docs:check
npm run release:check
npm run package:extension
npm run package:metadata
```

- `verify` checks source syntax/references and invokes the complete deterministic Node test suite with per-test-file timeouts.
- `docs:check` checks **local** Markdown and applicable HTML link targets. External site availability is not validated.
- `release:check` inspects manifest permissions, CSP, extension exposures and packaged runtime resources.
- `package:extension` creates the runtime-only deterministic candidate ZIP (and runs source verification unless explicitly skipped).
- `package:metadata` creates `BUILD_INFO.json` and `SHA256SUMS.txt` from the actual ZIP. It is a metadata generator, not a runtime smoke test.
- CI verifies ZIP integrity, sorted paths and fixed timestamps, two-build SHA-256 reproducibility and build metadata/checksum consistency before artifact upload.

**CI must be checked on the exact candidate SHA.** Failed, cancelled, queued or skipped jobs are not passing evidence. The optional browser harness requires additional locally installed Playwright and Chromium; it is not part of the default Node suite and uses deterministic mocked transport.

## Manual acceptance

Complete the [release acceptance matrix](ACCEPTANCE.md) and store scenario evidence in [`release-acceptance.json`](release-acceptance.json). Include: exact SHA, UTC date, OS/browser version, hardware if performance-related, inputs/actions, expected and actual results, diagnostics and evidence links.

Critical cases:

1. Unpacked MV3 load, popup/dashboard navigation, responsive layout, keyboard focus, chart drawings and accessibility.
2. Real REST/WebSocket startup, exchange timestamps, stale/disconnect/reconnect and independent data-source degradation.
3. Depth snapshot gaps and diff races: invalid book-dependent metrics remain unavailable until valid recovery.
4. Foreground price and advanced alert rules, browser permission denial, background alarms, multi-tab locking, worker suspension and dashboard closure.
5. Replay-only state isolation, invalid/oversized imports, recording persistence and sustained-session resource use.
6. Migration from the **actually installed build**, including local storage snapshots and rollback behavior.
7. Exact build assets, permissions, privacy disclosures, screenshots and listing claims.

```bash
npm run release:gate
```

This command is expected to **fail** while acceptance is pending; it verifies recorded requirements and commit binding, not the authenticity of evidence. A reviewer must evaluate every underlying test.

## Failure policy

A missing scenario remains **pending**. Do not substitute a screenshot or mock run for an interactive browser test, or present benchmark/synthetic measurements as real-client performance. Record failures and retest after fixes. Preserve previous release artifacts and user data when validating migration.

[Release procedure](RELEASE.md) · [Browser smoke checklist](SMOKE-TEST.md) · [Candidate guide](USAGE.md)
