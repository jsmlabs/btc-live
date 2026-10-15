# Phase 01 - source baseline

**Record type:** historical engineering checkpoint. This documents the **initial partial-extension input**, not the entire present `main` tree or a tested customer release.

## Source provenance

| Recorded input | Value |
| --- | --- |
| Original archive | `btc-live-analytics-v15.1-partial-extension(1).zip` |
| Original package type | Explicitly **partial extension** |
| Manifest/UI version | `1.22.0` / `V1.22.0`, despite differing filename label |
| Initial inventory | 63 files |
| Frozen source inventory | [`baseline.json`](baseline.json), containing original file hashes |
| Extension platform | Chromium Manifest V3 |

The candidate now integrated into `main` contains additional files and changes. The original hash inventory must **not** be represented as a hash of the current source tree.

## Initial module map

| Component | Role |
| --- | --- |
| `market/validators.js`, `market/market-state.js` | Incoming market-data contracts and validity |
| `market/binance-depth.js` | Depth snapshots and diff sequencing |
| `app/runtime.js`, `background/service-worker.js` | Foreground lifecycle and MV3 sampled tasks |
| `app/chart-runtime.js`, `ui/chart.js` | Candles, chart lifecycle and rendering |
| `ui/market-recorder.js`, `ui/event-replay.js` | Recording/replay research |
| `storage/` | Local preferences, notifications and session persistence |

## Original gaps

The input was missing a complete repository test suite and operational README. It could not establish actual Chromium MV3 behavior, live Binance feeds, store publication, migration or notification delivery. Phase 01 created an independent baseline and deterministic test starting point, without declaring the archive a ready release.

## How to use this record

Use `baseline.json` only to compare against the **original archived input**. Use [Architecture](ARCHITECTURE.md), [Testing](TESTING.md) and [Release](RELEASE.md) for present-day requirements.

[Historical phases](INDEX.md) · [Source README](../README.md)

