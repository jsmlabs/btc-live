# BTC Live Hardening Notes

BTC Live uses a fail-closed, validation-first approach for market data, local persistence, background scheduling, and release packaging.

## Current v1.13.0 invariants

- Manifest V3 only
- permissions exactly `storage`, `notifications`, and `alarms`
- Binance public Spot REST is the only host permission
- no content scripts
- no web-accessible resources
- no remote UI assets or executable JavaScript
- no inline scripts or event handlers
- no dynamic code execution
- zero runtime dependencies
- all external market payloads validated before state updates
- explicit runtime store allowlist

## Runtime hardening

- Market updates use Binance timestamps and trade sequencing to reject stale, duplicate, or lower-sequence data.
- Connection state transitions are centralized and deterministic.
- Price and 24h-stat freshness are evaluated independently.
- Reconnect behavior uses bounded deterministic backoff.
- Runtime startup and teardown are idempotent.
- Settings and diagnostics writes are serialized to prevent stale async writes from overwriting newer state.
- Chart runtime configuration fails before network/timer side effects when invalid.
- Binance kline OHLCV and interval boundaries are validated.

## Notification and background hardening

- Notification preferences are sanitized before use.
- Shared notification state is refreshed before evaluation to reduce cross-context duplication.
- Web Locks are used when available to serialize relevant cross-context mutations.
- Background checks are coalesced so overlapping triggers share one in-flight request.
- Background failures are contained and do not create false connection-health notifications.
- Periodic alarms are reconciled from desired settings/target state.

## v1.13.0 alert-manager hardening

- Alert targets and alert history are isolated from general settings storage.
- Legacy v1.12.0 absolute targets migrate only when the new target store does not yet exist.
- Target count is capped at 50.
- Alert history is capped at 100 events.
- Persisted target/history rows are sanitized before use.
- Target mutations and history appends are serialized with Web Locks when available.
- All simultaneously reached targets transition to triggered state while at most one native target notification is delivered for a market snapshot.
- Non-delivered simultaneous target events are recorded as `SUPPRESSED` rather than being emitted later.
- Background scheduling reconciles when either settings or target storage changes.

## Release verification

`npm run release:check` performs static verification, the deterministic Node.js test suite, and explicit store packaging.

Current release baseline:

- 96/96 tests passing
- 35 explicitly allowlisted runtime files
- zero runtime dependencies
