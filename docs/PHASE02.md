# Phase 02 - Feed Integrity & Recovery

## Scope and implementation

- `market/binance-depth.js`: buffered initial snapshot synchronization and `pu` sequence continuity remain in place. Update application now validates a candidate depth book before committing updates: crossed, empty-side or overflow candidates cannot mutate the last accepted book. `snapshot()` provides `ageMs` and `valid`, and never exposes a book after the freshness timeout even if the scheduled watchdog callback has not run. Invalid input or detected continuity failure reconnects and hides the book.
- `market/binance-aggtrades.js`: `snapshot()` provides `ageMs` and `valid`; expired trade data is returned as `STALE` even between watchdog invocations. Trade ID deduplication and segment breaks remain unchanged. Aggregate trade IDs are **not** assumed contiguous.
- `scripts/verify.mjs`: discovers and executes all `tests/*.test.js` rather than just the Phase 01 test.
- `tests/feed-recovery.test.js`: deterministic mock socket, clock, and HTTP controls cover transactional update failure, delayed snapshot anchoring, immediate stale gating, broken `pu` continuity, late aborted snapshot completion, invalid events and trade age.

## Compatibility and limits

- No new permissions or dependencies. Existing `status`, `updatedAt`, `error`, `book` and `segment` fields are retained; `ageMs` and `valid` are additive.
- Manifest remains `1.22.0` because this is a staged, partially supplied extension rather than a release.
- No real Chromium/Firefox runs, no live Binance integration, no CI remote-run verification, no synthetic candle-feed recovery harness. The existing candle pipeline is unchanged. Underlying mutable `Map` objects of the internal depth book remain reachable to trusted in-process consumers; no additional API isolation is claimed.
- The depth staleness timer still initiates reconnect as before. On-demand reads additionally gate stale snapshots before the timer fires.
- No statistically validated live trading data or guarantees about upstream Binance availability.

## Verification

Run `npm run verify` in the project root. The static script checks manifest, relative imports, script syntax and HTML references, then runs all tests. For browser validation also complete `docs/SMOKE-TEST.md` and explicitly test disconnect/reconnect and background tab suspension.
