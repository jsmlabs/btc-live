# Engineering audit — pass 4 (performance)

Date: 2026-11-25. Baseline: `bf5c454fdc582074fcf33a5f15b130a8cdc989e5`. Independent branch; no changes to feed semantics, alert scheduling, permissions or dependencies.

| ID | Priority | Finding | Change |
| --- | --- | --- | --- |
| AUD-15 | Medium | Capture copies both depth maps even for scalar-only trade events. | Clone maps only for depth diffs, retaining transactional rejection. |
| AUD-16 | Medium | Replay recalculates depth bands on every trade even when the depth book has not changed. | Recompute only on snapshot/diff; invalidate on depth gap, enforce original freshness and clone per-frame band objects. |
| AUD-17 | Medium | Replay drawing/metadata checks copy entire recordings unnecessarily; analytics paint copies history twice; trade markers bypass frame coalescing. | Read recorder state/count, reuse one history snapshot, schedule trade-marker rendering through existing render scheduler. |

## Evidence

Synthetic isolated JS fixture: 500 levels per side, 1 initial snapshot, 990 trades, 10 depth diffs, 1,001 replay frames. Instrumented Map copy constructors and liquidity aggregation calls, not wall-clock time. Baseline: 2000 map copies / 1000000 entries, 1001 aggregations. Candidate: 20 map copies / 10000 entries, 11 aggregations. All frame values identical by serialized comparison. Two behavior regression cases passed against both original and revised modules (ASCII fixtures using a test encoder adapter). Dashboard call-site changes inspected; actual browser wiring untested.

No measured CPU, heap, FPS or latency improvement claimed. Native Node and installed browser checks pending. Retain existing alert observation frequency; advanced-alert queue and actual live resource budgets require separate review. No merge, deployment or release.
