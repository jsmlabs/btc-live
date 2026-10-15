# Browser smoke checklist - NOT EXECUTED

Manual tests require a Chromium browser and active Binance network access. Record browser version, OS, date/time and outcomes for each case.

- [ ] Extension loads unpacked without manifest errors; popup opens and displays expected loading state.
- [ ] Dashboard entry opens; navigation among Live / Analytics / Replay / Alerts / Diagnostics / Settings works.
- [ ] Valid Binance connection eventually shows live price and data freshness, with reasonable timestamps.
- [ ] Disable network; verify stale/error labels, reconnection after restoring connectivity and absence of false valid book analytics.
- [ ] Reload dashboard during socket startup; verify no duplicated UI updates or uncaught errors.
- [ ] Close/reopen popup, reload extension, suspend/restart worker; confirm persisted settings and intended alert behavior.
- [ ] Create / edit / remove alert target, test notification with browser permission, verify failure/denial path.
- [ ] Change chart timeframe, pan/zoom and interact with drawing tools where available.
- [ ] Record and replay a session; validate no replay-generated real notifications.
- [ ] Import invalid and oversized replay data; verify safe rejection and no partially applied state.
- [ ] Test narrow viewport and keyboard navigation; check console for exceptions and layout overflow.

Write observed results and evidence separately; do not mark these as passed without execution.
