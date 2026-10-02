# Maintenance Issue Taxonomy

Use these classifications for v1.0.x maintenance work.

## Primary categories

- `bug` - reproducible defect in existing behavior
- `regression` - behavior that worked in a previous release and now fails
- `browser-compat` - Chrome, Chromium, Firefox, or browser lifecycle compatibility
- `binance` - Binance REST/WebSocket contract or connectivity compatibility
- `store-policy` - Chrome Web Store or distribution-policy requirement
- `security` - security defect or hardening required to preserve existing guarantees
- `ui-regression` - visual or interaction regression without new functionality
- `build-release` - build, packaging, reproducibility, or release-process defect

## Severity

- `severity:critical` - security, unusable extension, or store-removal risk
- `severity:high` - core live market-data path materially broken
- `severity:medium` - important existing behavior impaired with workaround
- `severity:low` - minor defect with limited user impact

## Patch eligibility

An issue is patch-eligible only when:

1. Existing v1.0.x behavior is affected.
2. The failure can be reproduced or is backed by explicit store/browser feedback.
3. The proposed change is backward compatible.
4. The fix does not introduce a new product capability.

Feature requests belong outside the v1.0.x maintenance line.
