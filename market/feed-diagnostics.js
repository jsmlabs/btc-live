/** Independent, session-local counters. Browser WebSocket error callbacks do not reveal HTTP/TLS cause. */
export function createFeedDiagnostics({ now = () => Date.now() } = {}) {
  const feeds = new Map();
  function ingest(name, snapshot) {
    if (!['depth', 'trades'].includes(name) || !snapshot || typeof snapshot.status !== 'string') return;
    const at = now();
    let state = feeds.get(name);
    if (!state) {
      state = { status: 'IDLE', transitions: 0, reconnects: 0, liveTransitions: 0, lastLiveAt: null, lastError: '', changedAt: at };
      feeds.set(name, state);
    }
    if (state.status !== snapshot.status) {
      state.transitions++;
      if (snapshot.status === 'RECONNECTING') state.reconnects++;
      if (snapshot.status === 'LIVE') { state.liveTransitions++; state.lastLiveAt = at; }
      state.status = snapshot.status;
      state.changedAt = at;
    }
    if (snapshot.error) state.lastError = String(snapshot.error).slice(0, 180);
  }
  function snapshot() {
    const result = {};
    for (const name of ['depth', 'trades']) result[name] = { ...(feeds.get(name) ?? {
      status: 'IDLE', transitions: 0, reconnects: 0, liveTransitions: 0, lastLiveAt: null, lastError: '', changedAt: null
    }) };
    return result;
  }
  return { ingest, snapshot };
}
