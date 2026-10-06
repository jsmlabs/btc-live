# v1.9.0 Step 1 Hardening Pass

This pass preserves the existing Manifest V3 architecture, permissions, Binance-only network surface, public-data model, and user-facing feature set while strengthening validation and deterministic runtime behavior.

## Changes

- Sanitize optimistic settings before rendering and sanitize persistence results before accepting them back into runtime state.
- Validate chart runtime limit, refresh cadence, data adapters, and timing adapters before side effects occur.
- Validate Binance kline interval alignment and close-time boundaries before chart data is accepted.
- Make popup and dashboard teardown explicitly idempotent across page lifecycle events.
- Expand static release verification for semantic version syntax, English document language, viewport metadata, and unexpected extension execution surfaces.
- Add regression tests for settings sanitization, invalid chart runtime configuration, and malformed kline interval boundaries.

## Verification

- `npm run verify`: 76/76 tests passing.
- `npm run release:check`: passing.
- Store build: 29 explicitly allowlisted runtime files.
- Runtime dependencies: none.
- Extension permission: `storage` only.
- Host permission: `https://fapi.binance.com/*` only.


## v1.13.0 Alert Manager Hardening

- Separates alert targets and alert history from general settings storage.
- Migrates legacy v1.12.0 absolute targets only when the new target key does not yet exist, so an intentionally empty target list remains empty.
- Caps target count at 50 and alert history at 100 events.
- Sanitizes persisted target/history rows before use.
- Serializes target mutations and history appends with Web Locks when available.
- Marks all simultaneously reached targets triggered while delivering at most one native target notification for the market snapshot.
- Reconciles background scheduling when either settings or target storage changes.
- Adds deterministic regression coverage for migration, history bounds, multi-target priority, suppression and independent re-arming.

## v1.14.0 Futures Source Hardening

- Restricts REST access to `https://fapi.binance.com/*` and WebSocket access to `wss://fstream.binance.com`.
- Uses Futures 24h ticker and book-ticker REST responses as separate validated inputs before composing a snapshot.
- Uses Futures aggregate-trade/ticker and book-ticker streams with independent validation and ordering.
- Prevents stale REST book snapshots from replacing newer live bid/ask state.
- Release verification rejects legacy Binance Spot REST/WebSocket endpoint literals in runtime JavaScript and the manifest.
