# BTC Live - historical v1.22.0 source notes

> [!NOTE]
> **Archive, not a current release announcement.** This document describes the historical `1.22.0` source milestone. It does **not** certify the integrated v16 Phase 01–10 candidate, indicate the current Chrome Web Store version, or imply a signed-off customer ZIP.

## Historical focus

The earlier v1.22.0 source iteration emphasized independent recovery of public Binance Futures market/book streams, a validated REST price fallback, stale-book degradation and safer price-alert evaluation.

| Area | Recorded design change |
| --- | --- |
| Market and book streams | Independent reconnect and bounded retry paths |
| Price fallback | Preserve validated REST ticker when optional book fetch fails |
| Feed degradation | Do not treat a stale book quote as an equally fresh market feed |
| Alert safety | Suppress stale/reconnecting price triggers; support target rearm hysteresis |
| Background checks | Scheduled sampling and bounded local status, not continuous observation |
| Verification | Deterministic regression fixtures and optional Chromium DOM / mocked-WebSocket smoke |

The old `btc-live-chromium-v1.22.0-store.zip` name and **36-file** package size belong to the **historical build procedure**, not the current candidate. The current `npm run package:extension` creates a deterministic *candidate* ZIP with its own verified runtime count and SHA-256 metadata.

## Release boundaries

The current `main` includes additional depth/flow research, recordings, replay and advanced dashboard alert code. None becomes a stable customer release simply by being present in source. Actual MV3 notifications, live Binance behavior, upgrades, package contents, screenshots and store submissions require [formal acceptance](docs/ACCEPTANCE.md).

[Current changelog](CHANGELOG.md) · [Release guide](docs/RELEASE.md) · [README](README.md)
