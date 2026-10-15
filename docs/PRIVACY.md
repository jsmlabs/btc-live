# Privacy implementation notes

These notes supplement the canonical [Privacy Policy](../PRIVACY.md) for the `main` development candidate. They describe intended source behavior, **not** a completed independent privacy assessment of a published store build.

## Local data flow

```text
Public Binance Futures API/streams
             |
      Runtime validation
             |
     UI + local state
        /        \
Chrome extension  IndexedDB
storage           replay sessions
             |
  Optional native OS notifications
```

Market connectivity uses public exchange endpoints and does not require authenticated trading access. Display preferences, chart/workspace state, enabled rules and alert history are kept in extension storage. Supported recorded sessions/events can be persisted in browser IndexedDB. Browser permissions, operating-system notification surfaces, profile access and user exports define additional exposure.

## Permission review

| Source declaration | Operational requirement |
| --- | --- |
| `storage` | Locally persisted settings and state |
| `notifications` | Native alert display when allowed |
| `alarms` | Sampled background checks subject to Chromium scheduling |
| `https://fapi.binance.com/*` | Binance USDⓈ-M Futures REST |
| CSP `wss://fstream.binance.com` | Futures WebSocket |

There is no content-script or page-content-reading permission in the reviewed manifest. Do not expand endpoint, execution or storage permissions without recording the change, reviewing data disclosure and validating the final package.

## Retention, integrity and disclosure

- **Preferences/history:** browser-managed local extension storage; validity and quota/failure handling belong to the storage layer.
- **Recordings:** local IndexedDB with import limits, schema validation and session integrity handling. Exported files are under the user's control.
- **Logs and support bundles:** may expose screen content, rule settings or trade observations. Redact unrelated identifiers before publishing.
- **Notifications:** the OS may retain previews/history depending on device policy.
- **Deletion and migration:** profile/extension removal can cause data loss; a public upgrade requires an observed migration and rollback test.

**Privacy acceptance** is a mandatory customer-release condition, not inferred from these descriptions. Check the exact final manifest, network behavior, Chrome Web Store privacy questionnaire and user-visible disclosures. Record findings in [Release acceptance](ACCEPTANCE.md).

[Privacy policy](../PRIVACY.md) · [Security](../SECURITY.md) · [Architecture](ARCHITECTURE.md)
