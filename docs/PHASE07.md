# Phase 07 - recording, replay and research

**Historical engineering record.** Replay is an offline research feature, not a feed for live market state, trade execution or alert delivery.

## Recorded capabilities

- Event playback with deterministic reconstruction for seeking/stepping, including step backward and forward.
- Temporary bookmarks, bounded to **64** for the currently loaded event recording. They are cleared on a new session/load/import and are not persisted.
- Timeline scrubbing and playback options **0.5×, 1×, 2× and 4×**, where supported.
- Read-only comparison of the active recording with an IndexedDB session after schema and integrity validation.
- Summaries of event count, elapsed recording time, price movement and coverage - **not trading profitability**.
- Separation of sample/event replay from live feed processing, durable live-rule state and browser notifications.

Recorded streams may have different coverage, clock fidelity or depth observations; reconstruction does not infer missing trade data.

## Deferred and unverified

Persistent bookmarks, guaranteed equivalent data coverage, extended import stress and actual Chromium memory/seek performance were not proved by this phase. They remain subject to [acceptance](ACCEPTANCE.md).

[Research usage](USAGE.md) · [Phase 08](PHASE08.md) · [Testing](TESTING.md)
