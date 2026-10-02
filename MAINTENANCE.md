# Maintenance Policy

BTC Live uses Semantic Versioning.

## v1.0.x scope

Patch releases are limited to backward-compatible fixes for existing v1.0.0 behavior.

Allowed:

- Binance connectivity fixes
- Chrome / Chromium compatibility fixes
- Firefox compatibility fixes
- UI regression fixes
- Error handling fixes
- Security fixes
- Build / packaging fixes
- Store policy or metadata adjustments required for continued distribution
- Documentation corrections that do not change product scope

Not allowed:

- New markets or symbols
- Charts
- Price alerts
- Toolbar price badges
- New background monitoring
- Futures mode
- New user-facing features
- Architecture expansion unrelated to a validated defect

## Patch workflow

1. Reproduce the issue.
2. Record expected vs. observed behavior.
3. Confirm the issue affects existing v1.0.0 functionality.
4. Make the smallest robust fix.
5. Run existing tests and add a regression test when practical.
6. Verify no unrelated behavior changed.
7. Update CHANGELOG.md.
8. Bump PATCH only, for example 1.0.0 -> 1.0.1.
9. Build Chromium and Firefox packages.
10. Tag and release only after verification.

## Baseline

v1.0.0 is the stable submitted baseline. Until a validated defect or store-policy requirement exists, no v1.0.1 release should be created.
