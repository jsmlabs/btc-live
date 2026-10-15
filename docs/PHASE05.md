# Phase 05 - chart interaction engine

**Historical engineering record.** Describes the chart controls implemented during this phase, not a completed real-browser usability test.

## Interaction contracts

- **OHLC snapping:** optional, enabled during editing/placing with `Alt` or explicitly through the drawing controller. Not a permanent default.
- **Hit testing:** shared clamped candle-coordinate lookup, so selections stay within valid chart bounds.
- **Pointer behavior:** capture for drawing drag/pan; pointer cancellation must release active interaction state.
- **Undo/redo:** restore a fully validated collection without dropping drawings stored for other timeframes.
- **Storage bounds:** existing collection limit of **80** annotations remains enforced.
- **Viewport:** anchor-aware zoom and pan remain separate from market-data ingestion.

Deterministic tests cover snapping, coordinate bounds, timeframe preservation and viewport anchors.

## Acceptance left open

Actual Chromium pointer capture, touch behavior, drag cancel, drawing persistence, keyboard focus, accessibility labels and live chart update interaction require real execution. A synthetic passing test is not proof of rendered correctness.

[User guide](USAGE.md) · [Phase 06](PHASE06.md) · [Smoke test](SMOKE-TEST.md)

