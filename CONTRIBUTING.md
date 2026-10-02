# Contributing

Contributions to BTC Live should preserve the project's small scope, privacy-first architecture, deterministic build process, and minimal permission model.

## Before You Start

For bug fixes, open or reference a reproducible issue first when practical.

For v1.0.x maintenance work, read:

- [MAINTENANCE.md](MAINTENANCE.md)
- [PATCH_RELEASE.md](PATCH_RELEASE.md)
- [ISSUE_TAXONOMY.md](ISSUE_TAXONOMY.md)
- [SECURITY.md](SECURITY.md)

## v1.0.x Contribution Rules

The v1.0.x maintenance line accepts only backward-compatible fixes to existing behavior.

Appropriate changes include:

- Reproducible bug fixes
- Browser compatibility fixes
- Binance connectivity or market-data compatibility fixes
- UI regression fixes
- Security fixes
- Build and packaging fixes
- Required store-policy adjustments
- Documentation corrections

Do not add new product capabilities to v1.0.x.

Examples of out-of-scope work:

- New markets or symbols
- Charts
- Price alerts
- Toolbar live-price badges
- Background market monitoring
- Futures data
- New user-facing settings or features

## Development Requirements

- Node.js 20 or newer
- No runtime dependencies unless explicitly justified and approved
- User-facing extension content must remain in English
- Preserve Manifest V3
- Preserve the minimal permission model
- Do not introduce remote executable code
- Do not introduce analytics, tracking, advertising, or backend dependencies
- Keep changes minimal and directly related to the issue being fixed

## Verification

Before submitting a pull request, run:

```bash
npm run verify
```

The verification pipeline covers:

- Unit tests
- Browser builds
- Release-integrity checks
- Deterministic packaging
- Reproducibility verification
- Package audit checks

A change is not release-ready if verification fails.

## Pull Requests

Use the repository pull request template.

A maintenance pull request should clearly document:

- The issue or failure being fixed
- Reproduction steps
- Root cause
- The minimal fix
- Verification performed
- Whether regression coverage was added
- Expected version impact

Avoid unrelated refactors in maintenance pull requests.

## Code Style

Follow the existing project structure and conventions.

Prefer:

- Clear browser-native JavaScript
- Explicit validation
- Deterministic behavior
- Small modules
- Predictable error handling
- Minimal comments limited to non-obvious logic

Do not reformat or restructure unrelated files.

## Security and Privacy

Never commit:

- API keys
- Credentials
- Tokens
- Private user data
- Secrets

BTC Live does not require Binance authentication or user financial data.

## Versioning

BTC Live follows Semantic Versioning.

For v1.0.x maintenance:

- PATCH releases fix existing behavior
- New functionality belongs in a future MINOR release
- Breaking changes require a future MAJOR release unless the project explicitly adopts another versioning decision

## Licensing

By contributing, you agree that your contribution may be distributed under the repository's MIT License.
