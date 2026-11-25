# Engineering audit — pass 2 (2026-11-25)

Baseline: `bf5c454fdc582074fcf33a5f15b130a8cdc989e5` (main). Independent of draft PRs #62 and #63. Targeted source review of chart lifecycle, depth input and history, liquidity persistence and advanced alerts.

| ID | Severity | Finding | Fix |
| --- | --- | --- | --- |
| AUD-06 | High | Chart socket error handler leaves its generation valid until reconnection; queued callbacks may restore READY after disconnect. | Invalidate generation and detach handlers immediately. |
| AUD-07 | Medium | Late successful REST response may update paused chart or offline candles if adapter ignores abort; offline does not abort in-flight refresh. | Abort on offline, clear stream freshness and reject aborted/hidden responses. |
| AUD-08 | High | Empty/whitespace depth quantity coerces to zero (delete); duplicate snapshot prices silently overwrite one another. | Reject blank fields and duplicate snapshot prices; preserve ordered diff updates. |
| AUD-09 | Medium | A disconnect in the current 2s slot is dropped, making interrupted observations look contiguous; undefined receipt timestamp also passes freshness guard. | Mark current slot unavailable and require valid timestamps. |
| AUD-10 | Medium | Liquidity persistence counts nonconsecutive presence and undercounts two contiguous samples. | Count consecutive trailing observations, capped at three. |

Verification: five focused cases fail against baseline and pass against revised source in isolated JavaScript harness with an AbortController test adapter. Not a native Node test or real browser run.

Advanced alert reconnection rearming is intentional per tests; no semantic change made. Full npm verification, browser smoke, alert integration, security/performance/storage audits and live exchange validation remain pending. No release or version change.
