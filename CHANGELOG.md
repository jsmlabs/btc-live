# Changelog


All notable changes to the BTC Live development candidate are recorded here. Entries are not evidence of an approved customer release.

## Unreleased

### Premium visual polish
- Refine popup price hero, consolidated metric strip, range, order quote row and primary terminal action with consistent shape, rhythm and narrow-window safeguards.
- Unify dashboard workspace heading, active navigation, chart-toolbar wrapping, key-value typography and settings/replay panel details.
- Extend shared optical tokens without changing data, chart math, permissions or storage.

### Popup visual refinement
- Replace the visually fragmented three-card 24-hour OHLC summary with a unified, compact statistic strip using subtle dividers, stable numeric alignment and narrow-popup typography.

### Quality assurance
- Run the existing synthetic Chromium DOM smoke suite as a separate GitHub Actions job and retain screenshots/logs as CI artifacts.
- Explicitly distinguish browser DOM regression evidence from installed-extension and manual release approval.

### Fixed
- Populate popup and dashboard footer versions from the installed extension manifest rather than hardcoded, outdated HTML.
- Harden number and control containment across all six dashboard workspaces and the popup.

### Tests
- Add manifest-version label regression tests and assert that both entrypoints use the shared renderer.

### UI and accessibility
- Introduce shared motion-duration and easing tokens for dashboard and popup controls, with reduced-motion overrides.
- Refine selected navigation states, menu entrance, popup primary-action feedback and narrow-viewport containment without animating market values.
- Add CSS contract checks for motion fallbacks and semantically selected navigation.

### Verification
- Development candidate only; manual Chromium, market-data and release acceptance remain pending.


### Visual regression coverage
- Expand deterministic dashboard workspace width matrix to 320–2560 CSS px (54 workspace/viewport pairs), retain additional responsive screenshots and check the unified 24h popup strip at four popup widths.
- These HTTP-served Chromium fixtures do not constitute installed-MV3 release acceptance.

### Chart toolbar usability
- Clarify semantic grouping and menu names for interval, chart appearance, technical indicators, overlays, drawing tools and navigation.
- Visually distinguish primary chart controls, align navigation on wider viewports and maintain full-width control groups on narrow viewports.
- Expand Chromium DOM regression assertions without altering chart calculations, market data or extension permissions.

### Installed Chromium extension smoke
- Exercise a genuinely loaded Manifest V3 extension in Chromium, verify extension origin and key popup/dashboard controls, and archive screenshots; keep manual live-data/release acceptance explicitly separate.

### Distribution candidate validation
- Load the unpacked release-candidate ZIP, not source checkout files, for the Chromium MV3 installation smoke and six-workspace screenshots.

### CSS maintenance
- Consolidate repeated design-token declarations and redundant popup/chart/navigation overrides without changing market rendering contracts.
- Preserve existing reduced-motion behavior and validate the unchanged visuals through synthetic and installed-MV3 Chromium CI.

### Installed responsive acceptance smoke
- Exercise packaged Chromium MV3 popup and dashboard at representative narrow and desktop widths; assert the consolidated 24h strip remains contained and reduced-motion tokens are respected.

## [1.25.8] - 2026-10-16

### Fixed
- Reject invalid candle opening timestamps before constructing time-axis ticks and overlay interaction geometry.
- Add deterministic regression coverage for malformed timestamp types and values.

### Verification
- Development candidate only; seven manual release gates remain pending.

## [1.25.7] - 2026-10-16

### Performance
- Calculate chart-window price and volume ranges in one pass, removing temporary arrays and unbounded spread arguments.
- Add large-history chart-window regression coverage.

### Verification
- Development candidate. Performance measurements in real Chromium and all manual acceptance gates remain pending.

## [1.25.6] - 2026-10-16

### Accessibility
- Synchronize the expanded chart control's `aria-expanded` state on initialization, expansion and restoration.
- Add a deterministic modal-interaction regression test for the accessible expanded state.

### Verification
- Development candidate only; real Chromium acceptance and all seven manual release gates remain separate.

## [1.25.5] - 2026-10-16

### Fixed
- Guard the visual render scheduler against delayed callbacks from cancelled animation frames. Obsolete callbacks cannot consume a new pending redraw after a synchronous flush.
- Add a deterministic regression test for stale frame callbacks following flush/reschedule.

### Verification
- Development candidate only. Automated CI and all seven manual customer-release gates remain independent.

## [1.25.4] - 2026-10-16

### Fixed
- Support multiple independent chart redraw listeners per SVG so overlay observers cannot silently replace each other.
- Unsubscribing one observer no longer detaches another; notification snapshots tolerate subscription changes during redraw.

### Verification
- Development candidate only; automated CI and manual browser acceptance remain separate gates.

## [1.25.3] - 2026-10-16

### Fixed
- Ignore zero, negative and non-finite live/24-hour price references when constructing chart overlays, preventing invalid market values from distorting the visible scale.
- Add deterministic chart model regression coverage for invalid and valid references.

### Verification
- Development candidate; live browser and release acceptance remain separate mandatory checks.

## [1.25.2] - 2026-10-16

### Fixed
- Normalize the BAT launcher's root-directory argument to avoid an invalid path caused by the trailing backslash before a quoted argument.
- Update the launcher regression test to require safe Windows path quoting.

### Verification
- Windows CI and interactive GUI acceptance must still be checked; this is a development candidate, not a published release.

## [1.25.1] - 2026-10-16

### Fixed
- Reject a fetched source checkout whose manifest version is older than the installed version, even if the Git commit is a valid fast-forward.
- Fail closed for invalid local version strings before attempting the merge.

### Verification
- Added Windows updater source regression assertions.
- Real Windows GUI acceptance and the seven customer-release gates remain outstanding.

## [1.25.0]

- Previous development candidate. Refer to repository history for earlier changes.
