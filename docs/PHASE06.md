# Phase 06 - terminal interface and design system

**Historical engineering record.** This phase focused on a restrained dark-terminal layout and keyboard control without changing market-data contracts.

## Implemented UI behavior

| Feature | Scope | Limitation |
| --- | --- | --- |
| Information density | Compact, Comfortable and Analysis | Changes spacing and composition, not exchange values |
| Panel composition | Standard, Wide and Stacked | Responsive presets, not freely dockable panels |
| Local preference key | `btcLiveTerminalV1` | Presentation-only persistence |
| Command palette | `Ctrl/Cmd+K`, arrows, Enter and Escape | Available actions respect the workspace controller |
| Focus mode | `F` outside editable controls | Chart presentation state, not market data |
| Source of authority | Existing workspace preset and sanitized settings | A hidden Simple-mode view cannot be opened through a palette bypass |

Existing chart interactions and storage/alert behavior were intended to remain compatible. No additional browser permission or runtime dependency was introduced for this phase.

## Browser evidence still required

Test keyboard order, focus restoration, narrow and ultrawide layouts, reduced-motion behavior, popup/dashboard lifecycle and chart pointer functionality in real Chromium. Styling alone does not establish accessibility.

[User guide](USAGE.md) · [Phase 07](PHASE07.md) · [Smoke test](SMOKE-TEST.md)
