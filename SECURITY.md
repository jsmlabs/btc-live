# Security policy

> [!IMPORTANT]
> **Development-candidate scope.** Current source with manifest `1.22.0`. The automated checks enforce selected source and package constraints but are **not** evidence of a complete security audit or a production-approved release.

## Security architecture

BTC Live is a read-only Chromium Manifest V3 extension that consumes **public** Binance USDⓈ-M Futures feeds. It does not request Binance login, API keys, wallet permissions or order execution access.

| Boundary | Security objective |
| --- | --- |
| Host access | Restrict the manifest to `https://fapi.binance.com/*`; allow expected Futures WSS via CSP |
| Executable code | Local extension scripts; no remote executable JS or `eval` execution paths |
| Browser permissions | `storage`, `notifications` and `alarms` only |
| Market data | Treat REST/WS responses as untrusted; validate symbol, numbers, order/time/sequence validity |
| Depth analytics | Invalidate metrics when snapshots or diff continuity are broken |
| Storage/imports | Sanitize persisted objects, reject malformed/oversized replay data, handle quota errors |
| Alert ownership | Live-only advanced evaluation, controlled state, Web Locks for cooperating dashboards |
| Distribution | Deterministic runtime-only ZIP, manifest/CSP checks and package integrity |

A connected WebSocket is not a trust assertion; neither a simulated test nor a UI label can override data validity. Browser-supplied user preferences are not an authentication/authorization boundary for exchange actions: the extension has no trading action in scope.

## Known operational limitations

Advanced-rule triggers are claimed before native notification attempts. This reduces duplicate attempts across cooperating dashboards but **can lose delivery** if permissions/OS transport fail. MV3 worker suspension and background scheduling can miss price movements; do not promise exactly-once or continuous alert coverage.

Replay imports and saved market observations can be corrupted, malformed or privacy-sensitive. Users should avoid sharing unredacted diagnostics.

## Required release security review

Before publishing a customer build, verify the **exact final artifact** in Chromium, including permissions, active network destinations, extension lifecycle, malformed exchange payloads, corrupt local storage, oversized imports, multi-tab behavior and notification-denial paths. Archive observed evidence in [Release acceptance](docs/ACCEPTANCE.md).

Automated `npm run release:check` verifies only static manifest/resource rules. Build checksums establish artifact integrity, **not** complete security.

## Reporting vulnerabilities

Use GitHub's **private vulnerability reporting** option if it is available for this repository. Avoid publishing exploitable details in a public issue before coordination. Include the affected source/release version, browser, minimally reproducible steps, observed impact and scope, but do **not** share credentials, tokens or sensitive recordings.

For non-security bugs see [Support](SUPPORT.md). For permitted contributions read [Contributing](CONTRIBUTING.md).

[Privacy policy](PRIVACY.md) · [Architecture](docs/ARCHITECTURE.md) · [Release guide](docs/RELEASE.md)
