import { reconnectDelay } from '../utils/backoff.js';

export const DEPTH_STREAM_URL = 'wss://fstream.binance.com/public/ws/btcusdt@depth@100ms';
export const DEPTH_SNAPSHOT_URL = 'https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=500';
export const DEPTH_STALE_MS = 6_000;
const MAX_LEVELS_PER_SIDE = 4_000;
const MAX_BUFFERED_EVENTS = 512;

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function parseLevels(levels, maxSize = 2_000) {
  if (!Array.isArray(levels) || levels.length > maxSize) return null;
  const result = [];
  for (const level of levels) {
    if (!Array.isArray(level) || level.length !== 2) return null;
    const [rawPrice, rawQuantity] = level;
    if (!['string', 'number'].includes(typeof rawPrice) || !['string', 'number'].includes(typeof rawQuantity)) return null;
    const price = Number(rawPrice);
    const quantity = Number(rawQuantity);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price * quantity)) return null;
    result.push([price, quantity]);
  }
  return result;
}

export function parseDepthEvent(message) {
  let value;
  try { value = typeof message === 'string' ? JSON.parse(message) : message; } catch { return null; }
  const event = value?.data ?? value;
  if (event?.e !== 'depthUpdate' || event?.s !== 'BTCUSDT' ||
      !positiveInteger(event.U) || !positiveInteger(event.u) || !positiveInteger(event.pu) ||
      event.u < event.U || !positiveInteger(event.E)) return null;
  const bids = parseLevels(event.b);
  const asks = parseLevels(event.a);
  return bids && asks ? { firstId: event.U, finalId: event.u, prevId: event.pu, eventAt: event.E, bids, asks } : null;
}

export function parseDepthSnapshot(value) {
  if (!positiveInteger(value?.lastUpdateId)) return null;
  const bids = parseLevels(value.bids, 1_000);
  const asks = parseLevels(value.asks, 1_000);
  if (!bids?.length || !asks?.length) return null;
  if (bids.some(([, qty]) => qty === 0) || asks.some(([, qty]) => qty === 0)) return null;
  if (Math.max(...bids.map(([price]) => price)) >= Math.min(...asks.map(([price]) => price))) return null;
  return { lastUpdateId: value.lastUpdateId, bids, asks };
}

export function createLocalDepthBook() {
  const bids = new Map();
  const asks = new Map();
  let updateId = null;
  let anchored = false;

  function replace(snapshot) {
    const validated = parseDepthSnapshot(snapshot);
    if (!validated) throw new Error('Invalid Binance depth snapshot');
    bids.clear();
    asks.clear();
    for (const [price, qty] of validated.bids) bids.set(price, qty);
    for (const [price, qty] of validated.asks) asks.set(price, qty);
    updateId = validated.lastUpdateId;
    anchored = false;
  }

  function apply(event) {
    if (updateId === null) return 'uninitialized';
    if (event.finalId < updateId || (anchored && event.finalId <= updateId)) return 'ignored';
    if (!anchored ? event.firstId > updateId || event.finalId < updateId
                  : event.prevId !== updateId) return 'gap';
    // Inspect only changed prices while keeping the published maps untouched.
    // Full-map cloning and rebuilding on every 100ms diff creates avoidable GC.
    const bidChanges = new Map(event.bids);
    const askChanges = new Map(event.asks);
    function inspect(current, changes, highest) {
      let size = current.size;
      for (const [price, quantity] of changes) {
        if (quantity === 0 && current.has(price)) size--;
        else if (quantity > 0 && !current.has(price)) size++;
      }
      if (size === 0) return { size, best: null };
      let best = highest ? -Infinity : Infinity;
      for (const [price, quantity] of current) {
        const next = changes.has(price) ? changes.get(price) : quantity;
        if (next > 0) best = highest ? Math.max(best, price) : Math.min(best, price);
      }
      for (const [price, quantity] of changes) {
        if (quantity > 0 && !current.has(price)) best = highest ? Math.max(best, price) : Math.min(best, price);
      }
      return { size, best };
    }
    const bid = inspect(bids, bidChanges, true);
    const ask = inspect(asks, askChanges, false);
    if (bid.size > MAX_LEVELS_PER_SIDE || ask.size > MAX_LEVELS_PER_SIDE) return 'overflow';
    if (!bid.size || !ask.size || bid.best >= ask.best) return 'crossed';
    // Apply original level order: delete-then-add sequences preserve Map semantics.
    for (const [target, levels] of [[bids, event.bids], [asks, event.asks]]) {
      for (const [price, quantity] of levels) {
        if (quantity === 0) target.delete(price);
        else target.set(price, quantity);
      }
    }
    updateId = event.finalId;
    anchored = true;
    return 'applied';
  }

  return {
    replace, apply,
    get bids() { return bids; },
    get asks() { return asks; },
    get updateId() { return updateId; },
    get anchored() { return anchored; }
  };
}

/** Independent dashboard-only market-depth feed; it never affects prices or alerts. */
export function createBinanceDepthRuntime({
  onChange = () => {},
  onEvent = () => {},
  socketFactory = (url) => new WebSocket(url),
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis)
} = {}) {
  const book = createLocalDepthBook();
  let status = 'IDLE';
  let updatedAt = null;
  let error = '';
  let disposed = false;
  let enabled = false;
  let connected = false;
  let socket = null;
  let retryTimer = null;
  let freshnessTimer = null;
  let controller = null;
  let requestTimeout = null;
  let attempt = 0;
  let generation = 0;
  let buffered = [];
  let pendingSnapshot = null;
  let snapshotInFlight = false;
  let snapshotRetryTimer = null;
  let laggingSnapshots = 0;
  let connectionStartedAt = null;

  const currentSnapshot = () => {
    const ageMs = updatedAt === null ? null : Math.max(0, now() - updatedAt);
    const fresh = status === 'LIVE' && ageMs !== null && ageMs <= DEPTH_STALE_MS;
    return { status: fresh ? 'LIVE' : status === 'LIVE' ? 'STALE' : status,
      updatedAt, ageMs, valid: fresh && book.anchored, error,
      book: fresh && book.anchored ? book : null };
  };
  const notify = () => onChange(currentSnapshot());
  const setStatus = (next, message = '') => {
    if (next === status && message === error) return;
    status = next;
    error = message;
    notify();
  };

  function clearConnection() {
    ++generation;
    connected = false;
    if (controller) controller.abort();
    controller = null;
    if (requestTimeout !== null) clearTimeoutFn(requestTimeout);
    requestTimeout = null;
    snapshotInFlight = false;
    if (snapshotRetryTimer !== null) clearTimeoutFn(snapshotRetryTimer);
    snapshotRetryTimer = null;
    laggingSnapshots = 0;
    connectionStartedAt = null;
    pendingSnapshot = null;
    buffered = [];
    const old = socket;
    socket = null;
    if (old) {
      old.onopen = old.onmessage = old.onerror = old.onclose = null;
      if (old.readyState === 0 || old.readyState === 1) old.close();
    }
  }

  function retry(reason) {
    if (disposed || !enabled) return;
    clearConnection();
    setStatus('RECONNECTING', reason);
    if (retryTimer !== null) return;
    const delay = reconnectDelay(attempt++);
    retryTimer = setTimeoutFn(() => { retryTimer = null; connect(); }, delay);
  }

  function acceptBuffered() {
    if (!pendingSnapshot || !buffered.length) return;
    const snapshotId = pendingSnapshot.lastUpdateId;
    buffered = buffered.filter((event) => event.finalId >= snapshotId);
    if (!buffered.length) return;
    if (buffered[0].firstId > snapshotId) {
      pendingSnapshot = null;
      if (++laggingSnapshots >= 3) { retry('Depth snapshot could not catch stream'); return; }
      snapshotRetryTimer = setTimeoutFn(() => { snapshotRetryTimer = null; loadSnapshot(); }, 250);
      return;
    }
    book.replace(pendingSnapshot);
    pendingSnapshot = null;
    for (const event of buffered) {
      const result = book.apply(event);
      if (result === 'gap' || result === 'overflow' || result === 'crossed') {
        retry('Depth update sequence interrupted');
        return;
      }
    }
    buffered = [];
    updatedAt = now();
    laggingSnapshots = 0;
    attempt = 0;
    setStatus('LIVE');
    // Synchronized local book after applying buffered diffs; it anchors deterministic receipt replay.
    onEvent({ kind: 'depth.snapshot', updateId: book.updateId,
      bids: [...book.bids], asks: [...book.asks] }, updatedAt);
  }

  async function loadSnapshot() {
    if (snapshotInFlight || !connected || disposed || !enabled) return;
    const id = generation;
    snapshotInFlight = true;
    const pendingController = new AbortController();
    controller = pendingController;
    requestTimeout = setTimeoutFn(() => pendingController.abort(), 5_000);
    try {
      const response = await fetchImpl(DEPTH_SNAPSHOT_URL, {
        method: 'GET', cache: 'no-store', credentials: 'omit',
        headers: { Accept: 'application/json' }, signal: pendingController.signal
      });
      if (!response.ok) throw new Error(`Depth snapshot HTTP ${response.status}`);
      const parsed = parseDepthSnapshot(await response.json());
      if (!parsed) throw new Error('Invalid Binance depth snapshot');
      if (id !== generation || disposed || !enabled) return;
      pendingSnapshot = parsed;
    } catch (cause) {
      if (id === generation && !disposed && enabled) retry(cause?.message ?? 'Depth snapshot unavailable');
      return;
    } finally {
      if (id === generation) {
        snapshotInFlight = false;
        controller = null;
        if (requestTimeout !== null) clearTimeoutFn(requestTimeout);
        requestTimeout = null;
      }
    }
    if (id === generation) acceptBuffered();
  }

  function connect() {
    if (disposed || !enabled) return;
    clearConnection();
    connectionStartedAt = now();
    setStatus('CONNECTING');
    const id = generation;
    try {
      socket = socketFactory(DEPTH_STREAM_URL);
    } catch (cause) {
      retry(cause?.message ?? 'Depth connection failed');
      return;
    }
    const current = () => id === generation && enabled && !disposed;
    socket.onopen = () => {
      if (!current()) return;
      connected = true;
      setStatus('SYNCING');
      loadSnapshot();
    };
    socket.onmessage = (message) => {
      if (!current()) return;
      const event = parseDepthEvent(message.data);
      if (!event) { retry('Invalid depth event'); return; }
      if (status !== 'LIVE') {
        buffered.push(event);
        if (buffered.length > MAX_BUFFERED_EVENTS) { retry('Depth event buffer exceeded'); return; }
        acceptBuffered();
        return;
      }
      const result = book.apply(event);
      if (result === 'gap' || result === 'overflow' || result === 'crossed') { retry('Depth update sequence interrupted'); return; }
      if (result === 'applied') {
        updatedAt = now();
        onEvent({ kind: 'depth.diff', firstId: event.firstId, finalId: event.finalId, prevId: event.prevId,
          eventAt: event.eventAt, bids: event.bids, asks: event.asks }, updatedAt);
        notify();
      }
    };
    socket.onerror = () => { if (current()) retry('Depth stream error'); };
    socket.onclose = () => { if (current()) retry('Depth stream disconnected'); };
  }

  function setEnabled(next) {
    if (disposed || enabled === Boolean(next)) return;
    enabled = Boolean(next);
    if (enabled) {
      if (retryTimer !== null) { clearTimeoutFn(retryTimer); retryTimer = null; }
      freshnessTimer = setIntervalFn(() => {
        if (status === 'LIVE' && updatedAt !== null && now() - updatedAt > DEPTH_STALE_MS) {
          retry('Depth feed stale');
        } else if (['CONNECTING', 'SYNCING'].includes(status) && connectionStartedAt !== null && now() - connectionStartedAt > 12_000) {
          retry('Depth synchronization timed out');
        }
      }, 1_000);
      connect();
    } else {
      if (retryTimer !== null) clearTimeoutFn(retryTimer);
      retryTimer = null;
      if (freshnessTimer !== null) clearIntervalFn(freshnessTimer);
      freshnessTimer = null;
      clearConnection();
      updatedAt = null;
      setStatus('PAUSED');
    }
  }

  function dispose() {
    if (disposed) return;
    setEnabled(false);
    disposed = true;
  }

  return { setEnabled, dispose, snapshot: currentSnapshot, retryNow: () => {
    if (!enabled || disposed) return;
    if (retryTimer !== null) { clearTimeoutFn(retryTimer); retryTimer = null; }
    connect();
  } };
}
