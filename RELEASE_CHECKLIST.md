# BTC Live v1.14.0 - Release Checklist

## Source and verification

- [x] Manifest version is `1.14.0`
- [x] Package version is `1.14.0`
- [x] English-only user-facing extension UI
- [x] `npm run verify` passes
- [x] 106/106 deterministic tests pass
- [x] `npm run release:check` passes
- [x] Store build contains exactly 35 allowlisted runtime files
- [x] No runtime npm dependencies
- [x] No account, API key, analytics, advertising, or tracking
- [x] Binance public USDⓈ-M Futures market data is the only external data source

## Permissions

- [x] `storage` is required for local extension state
- [x] `notifications` is required for native browser alerts
- [x] `alarms` is required for persistent background alert scheduling
- [x] REST host permission is limited to `https://fapi.binance.com/*`
- [x] Extension CSP permits only the required Binance Futures REST/WebSocket connections
- [x] No content scripts
- [x] No web-accessible resources

## v1.14.0 Futures migration regression

- [x] Live price uses BTCUSDT Futures aggregate trades
- [x] Rolling 24h statistics use the Futures ticker
- [x] Best bid/ask and spread use the dedicated Futures `bookTicker` path
- [x] REST fallback combines Futures ticker and book-ticker data
- [x] Dashboard chart reconciliation uses Futures klines
- [x] Ticker and book ordering are tracked independently
- [x] Legacy Spot REST/WebSocket endpoints are rejected by release verification
- [x] Existing settings, alerts, diagnostics, storage contracts, and DOM IDs remain compatible

## Documentation

- [x] README updated for v1.14.0 Futures architecture
- [x] CHANGELOG updated
- [x] Privacy policy updated
- [x] Security policy updated
- [x] Store listing updated
- [x] Store asset plan updated
- [x] GitHub release notes updated
- [x] QA checklist updated

## Store submission

- [ ] Re-capture screenshots that accurately show the current Futures popup/dashboard and alert manager
- [ ] Confirm final store icon and promotional artwork
- [ ] Upload the v1.14.0 Chromium store ZIP
- [ ] Confirm store privacy disclosures exactly match current permissions and behavior
- [ ] Add public privacy/support URLs
- [ ] Submit for review

## GitHub release

- [ ] Tag `v1.14.0`
- [ ] Publish release notes from `GITHUB_RELEASE.md`
- [ ] Attach the Chromium store ZIP
- [ ] Record package SHA-256
