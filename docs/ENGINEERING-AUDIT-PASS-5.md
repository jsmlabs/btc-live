# Engineering audit — pass 5 (UI and accessibility)

Date: 2026-11-25. Baseline: `bf5c454fdc582074fcf33a5f15b130a8cdc989e5`. Targeted interaction audit, not a full accessibility or responsive visual certification.

| ID | Priority | Finding | Change |
| --- | --- | --- | --- |
| AUD-18 | Medium | Storage synchronization resets the active workspace to landing view, even if still permitted; changing presets can hide the focused element. | Preserve allowed active view on sync; recover focus to the active navigation item when hiding its prior location. |
| AUD-19 | Medium | Workspace navigation, chart and heatmap key handlers can intercept modified browser shortcuts. | Ignore modified or handled events; preserve unmodified navigation. |
| AUD-20 | Medium | Global focus-mode keyboard handling runs before disclosure dismissal and can respond to repeated or composition events. | Prioritize open disclosure Escape, ignore repeated/composition/handled events. |

Verification: three controller regressions fail before and pass after in isolated JS with DOM substitutes. Added browser smoke checks for modified navigation and nested Escape. Chart/heatmap modifier guards inspected; actual Chromium execution pending.

The two Chromium runner pins from PR #65 are reproduced verbatim on this independent branch to avoid the known Ubuntu 26.04 tooling failure. No changes to Playwright, coverage, or runtime dependencies. PR #66 native verify and Windows updater passed, browser tooling installation failed with the old runner configuration; PR #65 already passed all four jobs.

Remaining: full visual inspection, real keyboard/screen-reader acceptance, touch interaction, focus and contrast checks across supported widths. No accessibility conformance claim. No merge or deployment.
