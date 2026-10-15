# Phase 06 - Terminal UX & Design System

## Scope
- Retain existing dark-terminal semantic tokens and extend with spacing/density tokens.
- Persistent presentation-only `btcLiveTerminalV1` preferences for compact/comfortable/analysis and standard/wide/stacked layouts.
- Chart-focus presentation control, separate from existing chart-internal focus, and keyboard-accessible command palette (Ctrl/Cmd+K; arrow keys, Enter, Escape). F toggles chart focus outside editable controls.
- No change to market data, storage schemas for previous settings, alerts, or replay.

## Limits
- Layout variants are predefined responsive presets, **not** arbitrary draggable/dockable panels. Drag resizing was deferred to avoid destabilizing the existing chart architecture.
- Browser pointer, resize, dialog focus and live-feed behavior require Chromium validation.
- Palette does not allow navigation to workspaces hidden by the existing Simple preset; workspace controller remains authoritative.
- No new permissions or runtime dependencies.

## Acceptance
Run `npm run verify`, then manually test keyboard navigation, preset persistence after reload, focus mode, command palette, mobile widths and reduced motion in Chromium.
