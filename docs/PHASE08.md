# Phase 08 - Advanced Alert Engine

Advanced live-only rules for price (USDT), signed taker CVD delta (BTC), executed trade volume (BTC) and visible order-book imbalance (-1..1).

Rules and runtime cooldown/arming state are stored in `chrome.storage.local` and validated before use. Up to 30 rules; feed quality checks fail closed. Book imbalance is computed from current visible levels only, not participant intent. Trade windows must be complete since the latest feed segment. One trigger per armed threshold crossing; re-arm requires movement beyond the 1% hysteresis band (minimum floor for zero threshold). Failed delivery is recorded in alert history and does not imply successful notification.

Existing price notifications and background alarms remain unchanged. Advanced rules are processed only in an open dashboard with enabled notifications and live feed updates (at most one evaluation per second). MV3 background alarms do NOT guarantee live order-flow monitoring. Replay never calls the advanced engine.

Caveats: Rule changes cannot guarantee atomic state across concurrently open dashboards; advanced state persistence and delivery are not transactional. Continuous feed observation, native notification delivery, browser restarts and multi-tab races require Chromium integration testing. No measured execution latency or delivery SLA.
