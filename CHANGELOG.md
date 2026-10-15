# BTC Live changelog

This file tracks **current product and release state**. Full details of older version milestones, including preserved dates and original engineering notes, are available in the [historical changelog archive](docs/HISTORICAL-CHANGELOG.md).

> [!IMPORTANT]
> **No stable v16 release is announced.** The `main` source integrates v16 Phase 01–10 functionality while `manifest.json` still reports `1.22.0`. That manifest version does not verify which build the Chrome Web Store currently distributes.

## Unreleased - current development candidate

### Product and research

- Extended the dashboard into **Live, Analytics, Replay, Alerts, Diagnostics and Settings** workspaces, with Simple/Advanced/Custom workspace preferences.
- Added chart layout/density controls, keyboard navigation, interactive annotations, optional OHLC snapping and additional chart intervals.
- Added Binance Futures aggregate-trade/depth processing, descriptive CVD, volume/imbalance and flow analyses with explicit validity conditions.
- Added local event/session recording and replay features, bounded imports and research comparisons.
- Added live-dashboard-only advanced alerts, feed validity suppression and cross-dashboard rule coordination.

### Quality, security and distribution

- Extended regression coverage for independent feeds, invalid/stale input, replay/alert isolation, storage validation and rendering.
- Maintained a restrictive Manifest V3 permission/CSP model with no trading-account permissions or runtime npm dependencies.
- Added reproducible candidate ZIP packaging, exact-build provenance, SHA-256 checks and CI artifact upload.
- Added an explicit release gate requiring separately reviewed Chromium, live-feed, MV3, migration, recording/load and store evidence.
- Rebuilt README, product handbooks, release guide, support, contribution and store materials around the current source rather than historical release assumptions.

**Not yet accepted:** actual customer Chromium workflows, Binance live reconnect/resync behavior, multi-tab/MV3 notifications, sustained load, migration and final store visuals. See [release gates](docs/ACCEPTANCE.md).

## Earlier source milestones

| Version record | Historical scope |
| --- | --- |
| `1.22.0` (2026-10-12) | Independent Futures feed recovery, safe price fallback and stale-alert suppression |
| `1.21.0` (2026-10-12) | Synthetic rendering scheduler and chart geometry-cache optimizations |
| `1.20.0`, `1.19.0` | Dashboard alignment, panel density and responsive layout iterations |
| `1.17.0` through `1.1.0` | Historical chart, notifications, background processing, Futures and UI increments |

These are **historical source-development notes, not an assertion of store publication or release readiness**. For detailed older entries consult [the full archive](docs/HISTORICAL-CHANGELOG.md) and [historical v1.22.0 notes](GITHUB_RELEASE.md).

[README](README.md) · [Documentation index](docs/INDEX.md) · [Release guide](docs/RELEASE.md)
