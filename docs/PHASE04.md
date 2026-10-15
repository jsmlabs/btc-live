# Phase 04 - order-flow intelligence

**Historical engineering record.** This phase developed descriptive, coverage-aware flow research, **not** a predictive or tradable signal engine.

## Implementation summary

| Measure | Recorded behavior | Limitation |
| --- | --- | --- |
| Rolling aggressive flow | **10s, 30s, 60s and 300s** observed windows with bounded accumulation | A complete elapsed observation window is required |
| Signed volume delta | Buy/sell aggressive executed BTC over observed events | Not exchange-wide historical CVD |
| Short-range divergence | Price changes versus validated price/delta sample continuity | `DESCRIPTIVE_ONLY`, not a confirmed swing prediction |
| Liquidity persistence | Visible aggregated depth bands across up to **30** valid samples | Not identified limit orders, absorption or spoofing proof |
| Confluence | Explicit source timestamps, sampling segments and unavailable reasons | No causal proof from asynchronous streams |

Freshness loss, reconnect or incomplete observation must invalidate dependent values rather than silently returning zero. Price, book depth and trade events are **not atomically synchronized**.

## Validation boundary

Deterministic regressions covered rolling windows, startup/stale/reconnect transitions, divergence, confluence and liquidity continuity. Live Binance data quality, network-specific gaps, DOM accessibility and extended Chromium performance are **not inferred** from those tests.

[User guide](USAGE.md) · [Phase 05](PHASE05.md) · [Acceptance](ACCEPTANCE.md)

