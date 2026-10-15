# Phase 07 - Replay & Research

- Existing sample replay and event replay remain isolated from live feeds, storage writes and alert execution.
- Event replay adds step backward/forward and temporary, bounded bookmarks (64 per currently loaded event recording). Bookmarks are deliberately not persisted; import, load, new recording and clear reset them.
- Current event recording can be compared read-only against a saved local IndexedDB session after its existing SHA-256 and schema validation. Comparison reports event count, recorded duration, availability counts and price change, and does not claim equivalent capture coverage.
- Both replay timelines already supported manual slider scrubbing and playback speeds (0.5x, 1x, 2x, 4x). Event renderer reconstructs complete deterministic frames before seeking; price, delta and depth use the same selected frame.
- No new browser permissions, packages or storage migrations.
- Limitations: no persistent bookmark schema, session overlay, sampled-session comparison, or Chromium browser test yet. Memory/canvas performance benchmarks pending Phase 09.
