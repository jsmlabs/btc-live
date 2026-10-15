# BTC Live - store asset and visual release policy

> [!CAUTION]
> The v16 development candidate has been integrated into `main`, but **is not yet approved for store publication**. Existing images in [`store-assets/`](store-assets/README.md) are historical and may show Binance Spot or an older UI. **Do not reuse them as evidence of current candidate behavior.**

## Identity

| Element | Direction |
| --- | --- |
| Background | Near-black, aligned with the actual extension UI |
| Accent | Restrained warm Bitcoin-orange (design reference `#F3A23A`) |
| Text | High-contrast white/neutral on dark surfaces |
| Identity | Original BTC Live icon and accurate Futures-market labels |
| Claims | Public market monitoring and research only; no execution or return promises |

No Binance protected logos, fabricated trade outcomes, invented prices, artificial reviews, fake connectivity statuses, or implied endorsement.

## Required release-specific assets

| Asset | Requirement |
| --- | --- |
| Extension icons | Confirm packaged PNG sizes 16, 32, 48 and 128 px |
| Popup screenshot | Real approved build showing BTCUSDT Futures price, data source and status |
| Dashboard screenshot | Actual chart/workspace and diagnostics with a verifiable observed session |
| Alert/settings screenshot | Real supported rules, browser limitations and saved settings |
| Chrome Web Store screenshots | Capture at an accepted resolution (typically 1280×800), inspect store requirements |
| Promotional tile | If required, create an original 440×280 asset matching approved branding |

Capture a **tested build at the final release SHA** in a real browser. Check small-screen legibility, visual hierarchy, clipping, chart labels, spacing, contrast and accessibility. Screenshots must be unaltered representations of the released product (privacy-sensitive values may be redacted transparently).

## Store submission gate

- [ ] Store screenshots match the approved package and its actual UI.
- [ ] Features shown are covered by real-browser acceptance, not just mocked tests.
- [ ] Manifest version, package, public listing and screenshots describe the same release.
- [ ] Permissions, privacy questionnaire, support and security links reviewed.
- [ ] No legacy Spot wording or outdated v1.0.x/v1.21.x imagery presented as current.
- [ ] Store review and public publication states confirmed separately.

The design archive/branding references may guide **visual styling** but are not acceptance evidence. Check [release readiness](docs/RELEASE.md) and [acceptance](docs/ACCEPTANCE.md) before promoting assets.

[Store listing](STORE_LISTING.md) · [README](README.md) · [Asset inventory](store-assets/README.md)
