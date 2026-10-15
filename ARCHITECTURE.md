# BTC Live architecture

**Status:** Chromium Manifest V3 development candidate, manifest `1.22.0`. This is the current architecture overview; [the detailed contract](docs/ARCHITECTURE.md) is the technical source of documentation.

## System map

```text
Binance USDⓈ-M Futures (public HTTPS + WSS)
           |
market/    Payload validation, transport, sequence and freshness
           |
app/       Runtime, chart ingestion, alerts and lifecycle
           |
ui/        Terminal, charts, analytics and replay
           |                   |
popup/     Compact view      dashboard/  Six workspaces

background/    MV3 sampled background price checks
storage/       User preferences, alert state and recorded sessions
```

## Contract by layer

| Boundary | Purpose | Constraint |
| --- | --- | --- |
| Network | Public Binance Futures snapshots and streams | External data is always untrusted |
| State | Combine valid market observations | Distinct price, ticker, trade, kline and depth freshness |
| Depth | Maintain synchronized order book | Snapshot/diff gaps invalidate dependent metrics |
| Flow | Summarize observed aggressive executions | Not an exchange-complete trade ledger or prediction |
| Chart | Display exchange-origin candles and annotations | Do not synthesize authoritative OHLC from ticker events |
| Alert engine | Conditional notification attempts | Replay isolation, live-data gating and at-most-once attempt semantics |
| Browser storage | Preserve settings and replay sessions | Validate imported/state records and handle quota errors |
| Extension package | Standalone Chromium runtime | Minimal permissions, locally hosted JS, no account credentials |

## Browser boundaries

The extension declares `storage`, `notifications` and `alarms`, with REST host access to `https://fapi.binance.com/*`. The CSP allows `wss://fstream.binance.com` for public Futures streams. The background service worker may be suspended at any time: **a scheduled alarm is not a persistent process**.

Advanced alerts evaluate live metrics only while a dashboard is open; price alerts additionally have sampled background checks. Trigger persistence precedes attempts at native notifications, so delivery may fail without retry. Historical replay does not feed the live alert engine.

## Validation status

Automated Node tests, static release checks and reproducible packaging are distinct from real Chromium, live Binance recovery, MV3 suspension, performance and migration acceptance. See [testing](docs/TESTING.md) and [release requirements](docs/ACCEPTANCE.md).

[README](README.md) · [Technical architecture](docs/ARCHITECTURE.md) · [Privacy](PRIVACY.md)
