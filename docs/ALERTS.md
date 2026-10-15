# Alerts: execution and delivery contract

**Status:** Development candidate. This document defines intended behavior and technical limits; actual browser/OS delivery remains subject to [acceptance testing](ACCEPTANCE.md).

## Choose the correct alert type

| | Standard price alerts | Advanced dashboard alerts |
| --- | --- | --- |
| Inputs | Price targets and percentage changes | Price, CVD, aggressive volume and visible book imbalance |
| Evaluation | Supported foreground activity plus sampled MV3 REST alarm checks | **Live dashboard open**; valid metric and enabled configuration |
| After dashboard closure | Sampling may continue while browser allows it | **Stops evaluating** |
| Replay | Does not use replay events | Explicitly excluded |
| Guarantee | No continuous sampling/delivery promise | No continuous sampling/delivery promise |

## Advanced rule behavior

- Validated rule types: `price`, `cvd`, `volume`, `imbalance`. Up to **30** rules can be stored.
- Threshold directions: above/below. Supported trade windows: **10, 30, 60 or 300 seconds**; live trade windows must have complete observed coverage.
- Book imbalance ranges from **-1 to 1** and represents visible levels only. Missing/stale depth suppresses evaluation.
- Configurable cooldown and hysteresis prevent immediate re-triggering. Threshold crossings are not independent market fills or trade signals.
- Advanced evaluation requires fresh live inputs. It is not initiated by session replay.

## Concurrent dashboards and notifications

The Web Locks API coordinates cooperating open dashboards; when locking is unavailable, the advanced path fails closed. The trigger state is **persisted before** attempting a native notification. This intentionally favors no duplicate attempts over delivery retries.

**At-most-once *attempt*** is the best available description, not exactly-once or guaranteed delivery. If the OS blocks the message, the browser is suspended, storage is unavailable, or the notification attempt fails, a condition may be recorded without an observed popup. Persistence and notification delivery are not one atomic transaction.

## Controls and feedback

Price target creation is disabled while its save is pending; repeated submits during that save do not create more targets. Pause/resume and remove operations show their outcome, with failed writes retaining the current stored target. Failed form saves preserve input. History clearing reports errors and is disabled for an empty history.

The explicit **Test notification** button in popup settings and dashboard Alerts shows pending, unavailable, accepted and failed request states. An accepted API request does **not** verify OS display or guaranteed delivery. These controls do not alter live evaluation, cooldown or trigger-persistence semantics.

## Diagnosing a missing alert

Check rule enablement, permission status, current workspace and open-dashboard state, feed validity/age, evaluation windows, Web Locks availability, cooldown/arming state and alert history. Background price checks can miss fast threshold excursions between polls; browser scheduling is not a real-time clock.

> [!WARNING]
> Alerts are informational. Never use them as the sole stop-loss, liquidation or exposure control.

[User guide](USAGE.md) · [Architecture](ARCHITECTURE.md) · [Tests](TESTING.md)

