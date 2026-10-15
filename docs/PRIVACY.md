# Privacy and data handling

> Scope: current v16 Phase-10 candidate configuration; the extension manifest remains `1.22.0`. Re-check permissions and endpoints at the exact release commit before publication.

BTC Live consumes public Binance USDⓈ-M Futures market data. It does **not** require a Binance account, exchange API key or trading permission and does not place orders.

## Permissions and endpoints

The MV3 manifest requests `storage`, `notifications`, `alarms` and host access to `https://fapi.binance.com/*`. Its extension-pages CSP permits connections to Binance REST and `wss://fstream.binance.com`. No extra remote analytics endpoint or third-party runtime dependency was added for the v16 candidate.

## Local data

Extension storage holds display preferences, alert rules/history/state and diagnostics. IndexedDB can hold replay sessions and recorded market events. Device access, browser profile and export handling therefore determine who can read this locally stored material. Some historical data can be sensitive even if the underlying market data are public; users should control retention and exported copies.

## Operational limitations

Native notifications expose alert content to the operating system. Logs and screenshots may contain market observations or preferences. Avoid publishing diagnostics with unrelated personal data. Background checks are sampled; continuous execution after dashboard closure is not promised for advanced rules.
