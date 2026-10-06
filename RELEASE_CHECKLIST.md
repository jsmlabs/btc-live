# BTC Live v1.13.0 - Release Checklist

## Source and verification

- [x] Manifest version is `1.13.0`
- [x] Package version is `1.13.0`
- [x] English-only user-facing extension UI
- [x] `npm run verify` passes
- [x] 96/96 deterministic tests pass
- [x] `npm run release:check` passes
- [x] Store build contains exactly 35 allowlisted runtime files
- [x] No runtime npm dependencies
- [x] No account, API key, analytics, advertising, or tracking
- [x] Binance public market data is the only external data source

## Permissions

- [x] `storage` is required for local extension state
- [x] `notifications` is required for native browser alerts
- [x] `alarms` is required for persistent background alert scheduling
- [x] Host permission is limited to `https://api.binance.com/*`
- [x] No content scripts
- [x] No web-accessible resources

## v1.13.0 alert-manager regression

- [x] Multi-target `Above` / `Below` alerts persist independently
- [x] Optional target labels are supported
- [x] Enable/disable and remove operations persist
- [x] Targets re-arm only after price crosses back over the configured level
- [x] v1.12.0 single targets migrate once without recreating intentionally deleted targets
- [x] Multi-target jumps produce at most one native target notification per snapshot
- [x] Additional crossed targets are marked triggered and recorded as suppressed
- [x] Alert history is bounded to 100 entries
- [x] Alert history can be cleared without modifying targets/settings
- [x] Background scheduling reconciles settings and target-store changes

## Documentation

- [x] README updated for v1.13.0 architecture
- [x] CHANGELOG updated
- [x] Privacy policy updated
- [x] Security policy updated
- [x] Store listing updated
- [x] GitHub release notes updated
- [x] QA checklist updated

## Store submission

- [ ] Re-capture screenshots that accurately show the current popup/dashboard and alert manager
- [ ] Confirm final store icon and promotional artwork
- [ ] Upload the v1.13.0 Chromium store ZIP
- [ ] Confirm store privacy disclosures exactly match current permissions and behavior
- [ ] Add public privacy/support URLs
- [ ] Submit for review

## GitHub release

- [ ] Tag `v1.13.0`
- [ ] Publish release notes from `GITHUB_RELEASE.md`
- [ ] Attach the Chromium store ZIP
- [ ] Record package SHA-256
