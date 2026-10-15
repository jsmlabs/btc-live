> **Current release gate:** No new release is approved by this documentation change. The unmerged expanded-workspace archive must pass integration, automated tests, real Chromium MV3 QA and packaging review before any tag/store submission. Historical statuses below remain as originally recorded.

# BTC Live v1.22.0 - Release Checklist

## Automated validation

- [x] Phase A visual-performance code retained; synthetic baseline preserved
- [x] Independent market/book feed recovery validated with deterministic simulated socket failures
- [x] REST ticker fallback validated when the book endpoint fails
- [x] Stale alert suppression and 0.05% target rearm hysteresis tested
- [x] Background check status and malformed-price handling tested
- [x] No new runtime permission, host, npm dependency or storage migration
- [x] Store package contains exactly 36 allowlisted runtime files
- [x] Manifest / package / popup / dashboard version labels aligned at `1.22.0`
- [x] Confirm GitHub Actions Node.js 22 / 24 both pass for pushed commit ([successful run](https://github.com/jsmlabs/btc-live/actions/runs/38306909480) on `1d99918`)

## Browser and manual QA

- [x] Real Chromium JS/DOM smoke with simulated feed outage and chart-cache checks
- [ ] Run the actual unpacked MV3 extension with a functional service worker
- [ ] Verify notification permission, target hysteresis, periodic alarms and shared state across popup/dashboard/background
- [ ] Confirm minute-sampled background checks are delayed or missed during browser sleep/close as documented
- [ ] Confirm live Futures market and order-book partial outage/recovery, stale book labels and offline recovery
- [ ] Replace old Spot screenshots with genuine Futures screenshots
- [ ] Profile actual Chromium CPU/frame timing on target hardware

## GitHub release (separate from repository commit)

- [x] Confirm v1.22.0 implementation is on `main` and repository CI is green (`1d99918`, [Verify run](https://github.com/jsmlabs/btc-live/actions/runs/38306909480))
- [ ] Tag the approved release commit `v1.22.0`
- [ ] Publish the GitHub release with notes, store ZIP and SHA-256
- [ ] Submit reviewed store assets for Chrome Web Store approval
