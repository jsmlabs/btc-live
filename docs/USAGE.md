# User guide

**Applies to:** the `main` **development candidate**, manifest `1.25.0`. The Chrome Web Store may distribute a different build. Use this guide for evaluation, not as a production-readiness certificate.

## Install without affecting an existing profile

1. Open a **separate Chromium test profile**.
2. Clone [BTC Live](https://github.com/jsmlabs/btc-live) or download the source branch.
3. Navigate to `chrome://extensions`; enable Developer mode.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. Click the toolbar icon for the popup; choose **Open market terminal** to access the full terminal.

**From an Actions build:** Download the artifact matching the source SHA, verify `SHA256SUMS.txt`, unpack the inner candidate ZIP, then load the extracted extension directory. A ZIP itself cannot be selected by Load unpacked. There is no npm build required for use; a network path to the public Binance Futures endpoints is required for data.

## Simplified Software Updates panel

The panel shows the installed version, the available published release or development source, and one **Check now** action. When a published release exists, **Get update** opens its release page; when only newer source exists, **Get latest development source** opens the installation guide. Use **More options** for automatic-check settings, release channel, and direct archive/checksum links. The extension never overwrites itself. For Git-based Windows development installs use the `update-btc-live.bat` starter and click **Reload** at `chrome://extensions`.

## Native Windows one-click updater

For a Git-cloned, unpacked development installation, double-click `update-btc-live.bat` at the checkout root. The small Windows PowerShell 5.1 / Windows Forms interface shows local and fetched manifest versions, the current Git operation, and a single **Update BTC Live** button. Git for Windows must already be installed; the updater needs no additional GUI framework or administrator permissions.

The updater checks the repository root, branch `main`, official `origin`, and absence of local edits or untracked files. It downloads the remote commit without tags, verifies fast-forward ancestry, updates without a merge commit, and confirms that HEAD matches the fetched commit. It stops on errors or diverged history without intentionally resetting or stashing work. If a bounded Git operation times out, the updater terminates and reaps that process before allowing Retry; it never interrupts the fast-forward merge. Progress remains indeterminate while work is ongoing because Git does not provide a reliable overall percentage. While Git is running, the window cannot be closed to avoid interrupting a repository-changing step; the fast-forward merge is never forcibly terminated by a UI timeout. After completion, the checked-out manifest must match the fetched version before success is displayed.

After successful source synchronization, choose **Open browser extensions** and manually click **Reload** for BTC Live in `chrome://extensions`. The updater cannot install a Chrome extension or prove that the browser reloaded. This development-source workflow is separate from approved Stable and optional experimental GitHub Releases. A ZIP-based installation requires a separate migration to a Git clone before using the updater.


## Explore the six workspaces

| Workspace | Start with | Expectations |
| --- | --- | --- |
| Live | BTCUSDT price, 24h range, market status and chart | Inspect age/source labels before making a decision |
| Analytics | Aggressive volume, CVD, displayed liquidity and descriptive comparisons | Incomplete observations are not authoritative volume history |
| Replay | Load a recorded session, scrub/step and compare supported data | Bookmarks are session-local; replay never notifies |
| Alerts | Configure price targets and supported advanced metrics | Advanced checks operate only with an open live dashboard |
| Diagnostics | Inspect reconnects, transport/feed state and freshness | A connected WebSocket does not establish a valid depth book |
| Settings | Personalize display and landing preferences | Local presentation options do not affect exchange data |

Navigation uses a sidebar on large screens, a scrollable bar on tablets and a two-row layout on phones with all six workspaces visible. Within navigation, use arrow keys, Home or End. A keyboard-visible **Skip to workspace** link bypasses navigation.

Open **View options** beside the workspace title for the workspace preset, dashboard density and panel layout. The popup has a labelled **Open market terminal** button in addition to its dashboard icon.

**Workspace presets:** Simple shows a reduced set of tabs; Advanced exposes all available workspaces; Custom permits a configured landing workspace. If a view is hidden by the current preset, the command palette omits that view. Alert delivery preferences remain in **Alerts**.

**Analytics views:** Overview combines the available observations; Liquidity shows displayed resting orders; Order flow focuses on executions; Behavior shows resting-liquidity changes without the execution controls. Select a view with Left/Right, Home or End while its button is focused. Switching views redraws the visible plots without starting another feed.

**Settings:** The keyboard reference lists global and chart-focused shortcuts. **Reset app settings** resets display and notification settings; it retains saved targets, replay sessions and the separate dashboard layout preferences.

## Chart controls

Open **Reference prices** to inspect current and 24-hour reference values without permanently expanding the toolbar. **Expand chart** opens the existing chart in a native modal: background controls are inactive until it closes. **Restore chart** or Escape returns it to its original workspace and scroll position. The chart and its drawings are retained. On short screens, the expanded panel can scroll.

The chart supports **1m, 5m, 15m, 30m, 1h and 4h** intervals with candles, line or area rendering. Use the visible zoom/pan controls, crosshair, selection and drawing tools, including horizontal/trend/measurement/zone annotations where available.

| Input | Action |
| --- | --- |
| `Ctrl+K` / `Cmd+K` (where supported) | Open command palette |
| Arrow keys, Enter, Escape | Navigate/execute/dismiss palette entries |
| `F` (outside editable controls) | Toggle focus mode, hiding overview cards |
| **Expand chart** / `Escape` | Enlarge / restore the chart; Escape also exits focus mode |
| `Alt` while drawing/editing | Optional snap to observed OHLC values |

Layouts are **Standard / Wide / Stacked**; densities are **Compact / Comfortable / Analysis**. Dashboard density persists across market repaints and takes precedence over the legacy compact-layout setting. **Compact Popup** in Settings controls popup spacing. Menus close on an outside click or Escape; Escape returns keyboard focus to the menu summary. These are responsive presets, **not** freely dockable panels. Actual keyboard, touch and resize behavior still needs real-browser acceptance.

## How data and alerts work

BTC Live consumes public **BTCUSDT Binance USDⓈ-M Futures** endpoints. CVD uses locally observed aggressive trades and resets/segments on relevant feed discontinuities; book imbalance is a measurement of displayed resting depth. Neither metric identifies particular traders, hidden orders, manipulation nor future direction. Missing, incomplete or stale measurements are unavailable - never assume a displayed zero.

Standard price/percentage alerts can use sampled background REST checks. **Advanced** price, CVD, volume and imbalance rules require a **live open dashboard**, acceptable feed freshness, notification settings, cooldown and Web Locks support for cross-tab serialization. A persisted trigger indicates an attempted notification, not guaranteed OS delivery. See [Alerts](ALERTS.md).

Target actions show saving, success and failure messages. Pending submissions cannot be duplicated; failed saves preserve form input. **Pause / Resume** controls each target, and paused targets are labelled accordingly. **Clear history** is disabled when there are no events. The explicit **Test notification** action reports API availability, acceptance or rejection; acceptance does not prove OS delivery.

## Recording and replay

Replay follows a visible sequence: **Capture or import**, **Save & load** for event sessions, then **Inspect & compare**. Sample Replay uses capture and inspection steps. Limits and provenance details remain available in **Capture limits & data boundaries**. A recording badge identifies active capture; playback and imports are never labelled live.

Supported sessions are saved locally; event replay can step and seek and supports temporary bookmarks and limited comparisons. A comparison reports coverage/events and price movement, **not trading performance**. Import and storage limits may reject corrupt or oversized sessions. Browser/profile deletion or quota issues can erase local recordings.

## Troubleshooting

| Symptom | Check first |
| --- | --- |
| Blank price or stale data | REST/WS connectivity, device clock, feed-age indicators, diagnostics |
| Book/flow metrics unavailable | Snapshot/diff continuity and trade window completeness; wait for valid resynchronization |
| No notification | Permission, enabled rule, cooldown, browser scheduling, dashboard state and notification history |
| Alerts stopped after closing dashboard | Expected for advanced rules; only supported sampled price checks continue |
| Chart missing interval data | Selected timeframe and exchange-origin candle feed health |
| Replay values missing | Recording coverage/schema and selected session |
| Display clutter or hidden view | Reset preset/layout/density, then review settings |

For reproducible issues, include browser version, source SHA (if unpacked), steps, observed/expected behavior and redacted logs using [Support](../SUPPORT.md). Never post private data or credentials.

**Safety:** BTC Live does not submit trades or guarantee alert delivery. Consult [release readiness](RELEASE.md) before distributing this candidate.

[README](../README.md) · [Full documentation](INDEX.md) · [Privacy](../PRIVACY.md)


## Check software updates

When an eligible newer release is available, a small link appears in the popup main view. Open **Settings > Software Updates** in the popup or full terminal. The panel shows the installed extension version, latest eligible GitHub release, previous successful check and current status. Use **Check for Updates** for a manual check. Enable or disable daily automatic checks and select Stable (default) or Preview. The **View Release Notes** link opens an official GitHub release in a new browser tab when a newer version qualifies. No download or installation happens automatically. Browser-store editions rely on normal Chrome Web Store updates. GitHub outages/rate limits retain prior information, which may be outdated. A new GitHub commit, draft release or CI candidate does not count as a stable update. When running an unpacked development candidate, update the local source directory (or extract a verified newer candidate build into a separate testing profile) and click **Reload** at `chrome://extensions`. The panel reads the installed version from the local manifest; it does not automatically fetch, replace, or install source files. The last attempted check and last successful check are shown separately.
