# BTC Live

BTC Live is a lightweight, privacy-first browser extension that shows the current BTCUSDT Spot price and essential rolling 24-hour market data from Binance in a compact dark-mode popup.

## Features

- Current BTCUSDT last-trade price
- Rolling 24h absolute and percentage change
- Rolling 24h high and low
- Rolling 24h quote volume in USDT
- Best bid, best ask, and spread
- LIVE / STALE / RECONNECTING / OFFLINE states
- Automatic WebSocket reconnect with capped exponential backoff
- REST initialization and recovery
- Local settings only
- Reduced-motion support
- No account, API key, analytics, advertising, or backend

## Architecture

BTC Live is intentionally popup-centric in V1. The popup loads a REST snapshot, opens Binance Spot WebSocket streams, updates local state, and cleans up when the popup closes.

Data responsibilities:

- `btcusdt@trade`: authoritative current last-trade price
- `btcusdt@ticker`: rolling 24h statistics, bid, ask, and quote volume
- `GET /api/v3/ticker/24hr?symbol=BTCUSDT`: initialization and recovery snapshot

## Requirements

- Node.js 20 or newer for development/build tasks
- A supported desktop browser

The extension itself has no runtime package dependencies.

## Development

```bash
npm test
npm run build
npm run package
npm run verify
```

`npm run build` creates:

```text
dist/chromium/
dist/firefox/
```

`npm run package` creates deterministic store-ready archives:

```text
btc-live-chromium-v1.0.0.zip
btc-live-firefox-v1.0.0.zip
```

## Load Unpacked - Chrome / Edge / Brave

1. Run `npm run build`.
2. Open the browser extensions page.
3. Enable Developer Mode.
4. Choose **Load unpacked**.
5. Select `dist/chromium`.

## Temporary Install - Firefox

1. Run `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Select `dist/firefox/manifest.json`.

## Permissions

BTC Live requests only:

- `storage`: persist the three local UI preferences
- `https://api.binance.com/*`: fetch the public BTCUSDT REST snapshot

The extension does not request access to browsing history, tabs, cookies, bookmarks, downloads, page contents, or user accounts.

## Security

- HTTPS/WSS only
- No `eval()`
- No remote executable JavaScript
- External market payloads are validated before entering application state
- No credentials or secrets are stored
- No telemetry or advertising SDKs

See [SECURITY.md](SECURITY.md).

## Privacy

BTC Live does not collect or transmit personal user data. Only local extension settings are stored on the user's device.

See [PRIVACY.md](PRIVACY.md).

## Browser Support

Primary targets:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Brave

Opera and Vivaldi are expected to work through Chromium compatibility but are best-effort targets for V1.

## Known V1 Limitations

- BTCUSDT Spot only
- No background market monitoring while the popup is closed
- No price alerts
- No toolbar live-price badge
- No charts
- No Futures data

## Market Data Attribution

Market data is provided by Binance public Spot market-data services. BTC Live is not affiliated with or endorsed by Binance.

## License

MIT. See [LICENSE](LICENSE).
