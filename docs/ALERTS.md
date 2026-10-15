# Alert semantics and failure modes

## Two different execution models

1. **Existing price alerts:** Dashboard/popup evaluation and a sampled MV3 background REST polling path. The background poller is not a continuous market stream; checks may be delayed, skipped or suppressed by browser lifecycle.
2. **Advanced rules:** Live dashboard evaluation for price, CVD, executed volume and bid/ask imbalance. Advanced rules do not run continuously after closing the dashboard; replay never triggers them.

Advanced rules use validated thresholds, windows (10/30/60/300 seconds for trade metrics), cooldowns, hysteresis and de-duplication. Invalid, incomplete, disconnected or stale feed data suppresses dependent evaluations. Source timestamps, rule state and available trigger history are diagnostic, not delivery guarantees.

## Multi-tab behavior

Where Web Locks is supported, a lock serializes cooperating dashboard evaluations. The rule state is persisted before an attempted notification so that repeated concurrent processing does not intentionally double-send. Consequently an attempted notification that fails after state persistence is **not retried automatically**. This is *at-most-once attempt*, not exactly-once delivery. Without Web Locks the advanced path fails closed. Actual browser multi-tab and MV3 suspension tests remain a release blocker.

## User expectations

A triggered condition is not equivalent to a delivered OS notification, a tradable signal, a live exchange fill, or a guarantee that every threshold crossing will be observed. Test notification permissions and use external risk controls for consequential trading decisions.
