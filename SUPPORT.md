# Support

BTC Live is a BTCUSDT Binance **USDⓈ-M Futures** monitoring tool. It does not execute orders or provide investment advice.

## Reporting defects

1. Check whether you installed the store build or loaded the `main` development candidate; **these can differ**.
2. Review [usage and troubleshooting](docs/USAGE.md), [alert semantics](docs/ALERTS.md) and [release status](docs/RELEASE.md).
3. Check feed state and freshness, browser notification permissions and network access to Binance Futures.
4. Search [existing issues](https://github.com/jsmlabs/btc-live/issues), then open a [bug report](https://github.com/jsmlabs/btc-live/issues/new/choose) with a reproducible case.

Include the manifest version, source commit when applicable, browser and OS versions, expected/observed behavior, steps, connection status, timestamps and **redacted** console/network evidence. Identify whether a feed failure concerns REST, WebSocket, depth resynchronization, or stale-data handling. For alerts, note whether a live dashboard was open and browser notifications were allowed.

**Security reports:** Do not publish exploits or credentials in an issue. Follow [SECURITY.md](SECURITY.md) to report suspected vulnerabilities privately when the channel is available.

## Boundaries

- Chromium Manifest V3 is the target; Firefox and other engines are not verified targets of the current candidate.
- v16 remains **development-only** pending real-browser, live-feed, lifecycle, migration and sustained-load acceptance.
- No Binance account, wallet, custody, balances, position, order or financial-account support.
- Sampled background checks are not continuous. An alert trigger is not guaranteed notification delivery.
- Independent project; not affiliated with or endorsed by Binance.

For code contributions, see [CONTRIBUTING.md](CONTRIBUTING.md).
