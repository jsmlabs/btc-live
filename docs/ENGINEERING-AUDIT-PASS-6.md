# Engineering audit — pass 6 (persistence and storage)

Date: 2026-11-25. Baseline: bf5c454fdc582074fcf33a5f15b130a8cdc989e5. Targeted storage review, not exhaustive storage or migration acceptance.

| ID | Priority | Finding | Fix |
| --- | --- | --- | --- |
| AUD-21 | Medium | Clear history bypasses the append lock and a pending append can restore deleted history. | Serialize clear with the existing Web Lock. |
| AUD-22 | High | Legacy target migration can race with target creation and overwrite new records. | Use the target lock for public migrating loads; internal mutation paths call the unlocked helper to avoid nested locking. |
| AUD-23 | Medium | Blocked IndexedDB open can later succeed after rejection, leaking a database connection. Read request failures also leave transaction rejection unobserved. | Close late orphan connections and await read/transaction promises together. |

Three focused regression tests fail before and pass after in isolated JS with storage, Web Locks and IndexedDB substitutes. No actual cross-tab browser or disk quota test performed. The transaction rejection change is reviewed but not separately reproduced. Existing Web Locks unavailable fallback remains unchanged. Notification state and whole-list target write interactions require further review; no claim of complete cross-context atomicity.

No dependency, version, release, merge or schema change.
