# Phase 02 - feed integrity and recovery

**Historical engineering record.** The changes below describe the phase implementation and its regression intent; real exchange/browser acceptance is still a separate [release requirement](ACCEPTANCE.md).

## Changes recorded

- **Order-book depth:** `market/binance-depth.js` buffers updates while anchoring to a REST snapshot and checks diff continuity using the exchange's applicable `pu`/update identifiers.
- **Transactional validity:** a crossed, empty-side or overflow candidate is rejected before changing the last accepted depth state.
- **Immediate stale gating:** `snapshot()` includes `ageMs` and `valid`; invalid or expired books are withheld even if a periodic watchdog has not yet fired.
- **Aggregate trades:** `market/binance-aggtrades.js` invalidates stale observations, retains deduplication/segment boundaries and **does not** assume IDs are strictly contiguous.
- **Test discovery:** the verification runner was expanded to execute all `tests/*.test.js` files.
- **Regressions:** deterministic controls exercised late snapshots, gaps, invalid events, reconnects and stale trade age.

## Preserved invariants

No new browser permissions or runtime dependencies were needed for this phase. Existing state fields were preserved; validity and age were additive. Invalid depth data must **never** silently surface as valid order flow.

## Limits and current verification

The historical tests used mocked clocks/network transport, not an actual Binance outage. Race handling, mutable in-process book maps, Chromium suspension and live reconnection still require final browser acceptance.

Run `npm run verify` for today's source suite; use [Manual smoke testing](SMOKE-TEST.md) for exchange-based evidence.

[Architecture](ARCHITECTURE.md) · [Phase 03](PHASE03.md)

