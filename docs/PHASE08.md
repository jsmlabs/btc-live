# Phase 08 - advanced alert rules

**Historical engineering record.** The current system distinguishes sampled standard price checks from dashboard-only advanced flow rules. Actual browser and OS notification delivery remains unverified for release.

## Advanced rule contract

| Field | Allowed range / meaning |
| --- | --- |
| Types | `price`, `cvd`, `volume`, `imbalance` |
| Direction | Above or below a configured threshold |
| Count | Up to **30** validated rules |
| Trade windows | **10, 30, 60 or 300 seconds** |
| Imbalance | Visible book balance from **-1 to 1** |
| Cooldown | Validated per-rule delay |
| Hysteresis | Configurable threshold reset band |
| State | Local extension storage, sanitized before evaluation |

Rules require live validated price/trade/book inputs as applicable. Stale feed ages, incomplete trade windows, an invalid depth book or disabled notifications can suppress evaluation. Replay never calls the live advanced evaluator.

## Lifecycle and delivery

Advanced rules are observed only while an actual dashboard is open and live feed data is available. The MV3 background price-alert path has different sampled semantics. A triggered condition and attempted notification do not imply OS delivery.

Concurrent dashboards, permission denial, browser restarts and suspension were not certified in this phase. Phase 09 added further locking protections.

[Current alert contract](ALERTS.md) · [Phase 09](PHASE09.md) · [Acceptance](ACCEPTANCE.md)
