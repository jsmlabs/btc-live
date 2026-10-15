# Phase 04 - Order-Flow Intelligence

## Implemented

- Multi-window taker flow: 10s, 30s, 60s, 300s within the bounded 300s accumulation buffer. The existing 60s panel totals and chart remain 60s and session CVD remains segment-relative.
- Each window exposes `status`, signed BTC delta, buy/sell BTC, and aggregate event count. Windows return `UNAVAILABLE` after startup, reconnect, and stale feeds until their observation duration has elapsed.
- Historical sampled price/CVD disagreement is exposed as `evaluatePriceDeltaDivergence` with explicitly checked sampling continuity, segment and price/flow validity, and interpretation status `DESCRIPTIVE_ONLY`. It appears in the market replay confluence text when valid.
- Explainable confluence adds source timestamps, sampling segment, bucket size, and structured rejection reason on unavailable input.
- `evaluateLiquidityPersistence` reports observed depth band persistence across up to 30 consecutive valid discrete snapshots, with first/last notional and the net visible change. The live order-flow panel reports the number of zones observed across all five samples.
- Five deterministic tests cover windows, startup/stale/reconnect, divergence, confluence and liquidity continuity. No new permissions or runtime dependencies.

## Definitions and limits

- The short-window deltas are *observed aggregate trade quantities*, not historical exchange-wide CVD. Binance aggregate trades do not identify distinct institutions or individual order intentions.
- Full elapsed capture time and fresh status qualify a window; silent transport gaps that were not signaled by the upstream feed cannot be independently proven absent. Never interpret the window as an exchange-audited trade history.
- Liquidity persistence is visibility in sampled depth bands, not individual limit-order persistence, absorption, manipulative intent or spoofing proof. Bands are aggregations, not order identities.
- Divergence compares the latest price and session CVD against previous extrema over a short contiguous sample series; it is *not* a swing-pivot confirmation or predictive/trading signal.
- Price, depth and trade data are not atomic/synchronized transactions. No causality is inferred from their alignment.
- Browser lifecycle and live Binance integration have not been run. UI performance and network-specific edge cases need manual/automated browser coverage.

## Verification

Run `npm run verify` using Node.js 20+. Then follow `docs/SMOKE-TEST.md` in Chromium, paying particular attention to reconnect, background suspend/resume, stale data masking, order flow, and replay.
