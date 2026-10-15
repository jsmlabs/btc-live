# Phase 09 - Performance & Security Hardening

## Implemented
- Cross-dashboard advanced alert serialization using the Chromium Web Locks API. The current persisted state is reloaded and the trigger is durably claimed before a notification attempt; this intentionally favors at-most-once attempts over automatic retries. If Web Locks is absent, advanced dashboard alerts fail closed. Existing legacy price background alerts are unchanged.
- Strict sanitization for persisted advanced alert engine state at both read and write boundaries (maximum 30 entries, validated IDs and timestamps).
- Optional, read-only bounded render scheduler diagnostics: frame/request/coalescing/error counters, maximum and average render duration (no event payloads stored).
- Tests for scheduler coalescing/errors, malformed persisted state and oversized imported recordings.

## Existing safeguards verified by inspection
- Event imports: 4 MiB maximum, event count limits, strict schema and depth/trade continuity verification.
- Observation imports: 1 MiB maximum, frame bounds and typed validation.
- IndexedDB session replay: size limits, integrity digest, bounded gzip decompression.
- Extension CSP and permissions: unchanged.

## Limits
- Browser integration, live Binance load/performance benchmarks, MV3 suspension, multi-tab actual notification races, and accessibility interaction checks were not executed.
- Render diagnostics provide instrumentation, not proof of performance improvement. Background and legacy notification paths have their own semantics.
- At-most-once claims can be lost as a notification if delivery fails after the claim; failure is logged. There is no transactional coupling between browser notification delivery and state storage.
