# BTC Live hardening guide

This document describes **current engineering safeguards and remaining validation work** for the `main` development candidate.

## Active constraints

| Surface | Required practice | Automated support |
| --- | --- | --- |
| Extension access | Manifest V3, restrictive CSP, minimal host/runtime permissions | `npm run release:check` |
| Exchange data | Validate symbols, timestamps, finite numbers and sequencing; reject stale or crossed data | Node regression tests |
| Depth and aggressive trades | Synchronized snapshots/diffs, bounded buffering and freshness gating | Recovery/validation tests |
| Local state | Sanitize settings/rules/history; handle invalid and oversized imports | Storage/replay tests |
| UI and analytics | Preserve provenance, expose degraded state and avoid fabricated values | Deterministic rendering/market tests |
| Alerts | Separate live data from replay, Web Locks where supported and at-most-once attempts | Alert/locking tests |
| Package | No remote executable JS, runtime-only deterministic ZIP, checksum/provenance | Static checks and GitHub Actions |

The current `manifest.json` requests `storage`, `notifications`, `alarms` and host access to `https://fapi.binance.com/*`; the CSP permits `wss://fstream.binance.com`. Verify these controls against every proposed distribution package.

## Live release blockers

- Untrusted/partial Binance feed behavior and depth resynchronization under actual network conditions.
- Chromium MV3 worker suspension, alarm timing, notification denial and two-dashboard races.
- Repeated corrupted/oversized session imports, local storage quota and migration paths.
- Representative CPU/memory/frame measurements and accessibility interaction checks.
- Review of final store ZIP resources, permissions, privacy disclosures and actual screenshots.

A passing static security check does not establish exploit-free behavior or a completed security audit. Findings should be recorded with preconditions, observed impact, reproductions, mitigation and retest evidence.

## Commands

```bash
npm run verify
npm run release:check
npm run package:extension
npm run package:metadata
```

For release approval use the independent [evidence matrix](docs/ACCEPTANCE.md) and real browser tests.

[Security policy](SECURITY.md) · [Architecture](docs/ARCHITECTURE.md) · [Release guide](docs/RELEASE.md)
