# BTC Live architecture

**Scope:** current repository `main`, extension version `1.22.0`. Expanded depth, order-flow, recording and replay modules exist in a separately supplied candidate archive but are not yet shipped in this tree. See [ARCHIVE_INTEGRATION.md](ARCHIVE_INTEGRATION.md).

## Runtime path

1. `popup/` and `dashboard/` initialize view-specific lifecycles through `app/runtime.js`.
2. `market/binance-rest.js`, `market/binance-websocket.js` and `market/binance-klines.js` obtain Binance public Futures data.
3. `market/validators.js` validates untrusted exchange payloads before `market/market-state.js` and connection-state coordination accept updates.
4. `app/chart-runtime.js`, `ui/chart.js` and the renderer/scheduler update presentation; visual coalescing must not defer market ingestion or alert evaluation.
5. `app/notifications.js` and `storage/alert-targets.js` coordinate bounded, user-configured alerts and histories; `background/service-worker.js` performs periodic alarm-driven checks.

## Trust and permission boundaries

| Boundary | Requirement |
| --- | --- |
| Binance REST/WS | Validate symbol, numeric ranges, timestamp ordering, freshness, kline invariants and order-book consistency |
| Browser storage | Sanitize settings and persisted alert rows; handle corruption and quota/errors |
| Notifications | Require enabled configuration, fresh market state, cooldown/rearm and deduplication |
| Background | Sampled polling, no guarantee of continuous or closed-browser operation |
| UI | Keep read-only market presentation distinct from trading execution; avoid presenting cached/stale values as live |
| Packaging | Only allowlisted local assets, self-hosted JS, no remote executable code |

The manifest permissions are `storage`, `notifications`, `alarms`; host access is restricted to `https://fapi.binance.com/*`; CSP also allows `wss://fstream.binance.com`. No content scripts or project-operated data service.

## Deployment and evidence

Run `npm run verify` for static validation and Node tests; `npm run release:check` additionally packages the store runtime. The optional browser smoke harness simulates streams and does not replace real MV3 service-worker, notification or live-market tests. Store approval and CI status must be checked separately.

## Candidate archive boundary

The separately supplied ZIP adds depth/flow analytics, local recording/replay, drawings and richer dashboard views. Its files must be merged without losing `tests/`, `scripts/`, CI or history. In particular, replay should be isolated from live alert evaluation; order-book resting liquidity must not be described as executed volume or liquidation data. **These are integration requirements, not claims that candidate features are present in `main`.**
