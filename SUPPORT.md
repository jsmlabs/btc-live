# BTC Live support

BTC Live monitors public BTCUSDT Binance USDⓈ-M Futures market activity. It does **not** access your Binance account, execute orders, provide investment advice or guarantee notification delivery.

## Before reporting a problem

1. Determine whether you are using a **Chrome Web Store build** or the `main` **development candidate**. Their behavior and versions may differ.
2. Review the [user guide](docs/USAGE.md) and [alert limitations](docs/ALERTS.md).
3. Check the browser extension status, Binance REST/WebSocket reachability, data-source freshness and notification permissions.
4. If an update caused data loss or a migration problem, **preserve the original browser profile** and stop testing the candidate on it.

## Submit a reproducible bug report

Use [GitHub Issues](https://github.com/jsmlabs/btc-live/issues) and the [bug-report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include:

| Field | Example of useful evidence |
| --- | --- |
| Version | Manifest version and Git SHA for unpacked source, or observed store version |
| Environment | Chromium/OS version, affected workspace and notification permissions |
| Reproduction | Exact steps, input conditions and expected versus actual result |
| Diagnostics | Redacted console output, feed ages, timestamps and screenshots |
| Scope | Whether the problem is continuous, intermittent or linked to a particular feature |

**Privacy:** Never attach tokens, sensitive browser exports, unrelated identifying details or unredacted personal logs.

## Escalation boundaries

Report suspected security vulnerabilities through the **private security-reporting channel if available**, following [Security](SECURITY.md), not as a public exploit description. Use [Contributing](CONTRIBUTING.md) for development workflow and [Release status](docs/RELEASE.md) to distinguish known candidate limitations from regressions.

BTC Live is independently developed and is not endorsed by Binance.
