# Architecture and trust boundaries

> Scope: v16 Phase-10 candidate source integrated into `main`, retaining manifest version `1.22.0`; runtime acceptance remains outstanding. See [Release](RELEASE.md).

BTC Live is a Manifest V3 browser extension with a popup, a long-lived page dashboard when open, and a service worker that may be suspended by the browser.

## Runtime data path

`Binance REST/WebSocket -> market validators and state -> app runtime -> UI selectors and render scheduler -> popup/dashboard`.

Depth diff continuity and REST-snapshot synchronization must complete before depth analytics are valid. Aggregate trades and candles have independent freshness requirements. Detection of stale data or gaps invalidates dependent metrics; a connected socket alone does not imply data validity.

The advanced alert engine consumes **live** validated dashboard metrics and is isolated from historical replay. Price background alerts use a different, scheduled MV3 path. Web Locks serialize advanced rules across cooperating dashboard instances where available; absent locking, advanced rules fail closed. An alert trigger is persisted before notification attempt: this provides an *at-most-once attempt*, not guaranteed delivery. A failed delivery may be permanently missed.

Recorded replay is based on stored events/samples, not a real-time exchange feed. Historical comparisons and bookmarks never assert executions or future price direction.

## Modules

| Directory | Responsibility |
| --- | --- |
| `market` | Binance connectivity, validation, depth/trade/candle market state, freshness |
| `app` | Runtime lifecycle, notifications, dashboard-only advanced alert evaluation |
| `ui` | Chart and drawing interactions, order flow, confluence, replay and scheduling |
| `storage` | Bounded local settings, alert history and recorded sessions |
| `popup`, `dashboard` | Presentation and user interaction |
| `background` | MV3 service worker and scheduled price checks |

Do not use model inference, UI status labels or synthesized metrics to override feed validity, permissions, storage validation or alert delivery decisions. Avoid unbounded replay/session sizes and event queues. Prefer minimal contracts with deterministic pure computations.
