# Phase 10 - release-engineering milestone

**Historical engineering record.** The phase introduced source/regression and packaging readiness work. It did **not** approve a production customer release. Current status and commands are maintained in [Release](RELEASE.md).

## Candidate verification path

1. Check syntax, local module references and deterministic Node tests using `npm run verify`.
2. Validate manifest permissions, CSP, extension resources and static contracts using `npm run release:check`.
3. Build the deterministic runtime-only archive using `npm run package:extension`.
4. Generate checksum and provenance metadata using `npm run package:metadata`.
5. Confirm [GitHub Actions](https://github.com/jsmlabs/btc-live/actions/workflows/verify.yml) succeeds for the **exact candidate SHA**.

These establish automated candidate-build validity, not actual browser functionality or public-store readiness.

## Pending approval gates

| Gate | What cannot be inferred from a green build |
| --- | --- |
| Chromium interface | Popup/dashboard load, focus, responsive keyboard and drawing behavior |
| Live market | Binance reconnect, data-age and depth snapshot/diff resynchronization |
| Alerts | Multiple tabs, notification denial, MV3 worker sleep and alarm timing |
| Recording/replay | Sustained memory/load, import bounds and isolation from live alerts |
| Compatibility | Upgrade from a genuinely installed prior version and retained settings |
| Store | Final-build screenshots, privacy/permissions and actual publication status |

The historical labels `v15.1` and `v16 Phase 10` are not semver release approvals; `manifest.json` remains `1.22.0` until a separately approved version change.

Complete the [active checklist](../RELEASE_CHECKLIST.md), [browser worksheet](SMOKE-TEST.md) and [acceptance matrix](ACCEPTANCE.md) before stable tagging or store publication.

[Historical phases](INDEX.md) · [Changelog](../CHANGELOG.md)
