# Phase 05 - Chart Interaction Engine

## Scope implemented
- Deterministic OHLC snapping helper with opt-in activation (`Alt` when placing/editing annotations, or `setSnapEnabled(true)`). No permanent global snap setting is introduced.
- A shared, clamped candle hit-test helper for drawing interactions.
- Pointer capture for chart panning and drawing dragging; pointer-cancel releases panning state.
- Undo/redo restoration now replaces the entire validated drawing collection, protecting annotations on other timeframes and respecting the existing 80-drawing limit.
- Regression tests for snapping, bounds, timeframe preservation and anchored viewport controls.

## Boundaries
The existing crosshair redraw synchronization, drawing tools, keyboard shortcuts and wheel-anchor zoom already existed and were retained. No new interface controls or storage-schema changes were necessary. SVG focus, touch behavior, drawing drag and actual browser rendering still need Chromium testing. Snap is only active when enabled explicitly or Alt is held and does not modify historical price data.
