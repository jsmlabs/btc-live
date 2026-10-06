import { fetchBtcSnapshot } from '../market/binance-rest.js';
import { createBinanceSocket } from '../market/binance-websocket.js';
import { CONNECTION_EVENT, applyConnectionEvent } from '../market/connection-state.js';
import {
  CONNECTION_STATUS,
  FEED_STATUS,
  STALE_AFTER_MS,
  applyBookTicker,
  applySnapshot,
  applyTicker,
  applyTrade,
  createInitialMarketState,
  deriveFeedHealth
} from '../market/market-state.js';
import {
  DEFAULT_SETTINGS,
  createSerialSettingsWriter,
  loadSettings,
  sanitizeSettings
} from '../storage/settings.js';
import {
  createSerialDiagnosticsWriter,
  createSessionDiagnostics,
  loadSessionDiagnostics,
  recordConnected,
  recordDisconnect,
  recordReconnect,
  resetSessionDiagnostics
} from '../storage/session-diagnostics.js';
import { reconnectDelay } from '../utils/backoff.js';

export const RUNTIME_TIMING = Object.freeze({
  SOCKET_DATA_TIMEOUT_MS: 8000,
  TICKER_DATA_TIMEOUT_MS: 12000,
  STALE_RECONNECT_GRACE_MS: 2000,
  FRESHNESS_TICK_MS: 1000
});

export function createBtcLiveRuntime({
  onChange = () => {},
  onWarning = (...args) => console.warn(...args),
  fetchSnapshot = fetchBtcSnapshot,
  createSocket = createBinanceSocket,
  loadSettingsValue = loadSettings,
  loadDiagnosticsValue = loadSessionDiagnostics,
  persistSettings = createSerialSettingsWriter(),
  persistDiagnostics = createSerialDiagnosticsWriter(),
  resetDiagnosticsValue = resetSessionDiagnostics,
  now = () => Date.now(),
  isOnline = () => globalThis.navigator?.onLine !== false,
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis)
} = {}) {
  let state = createInitialMarketState();
  let settings = { ...DEFAULT_SETTINGS };
  let diagnostics = createSessionDiagnostics(now());
  let settingsRevision = 0;
  let socket = null;
  let socketGeneration = 0;
  let socketDataTimer = null;
  let tickerDataTimer = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let nextRetryAt = null;
  let staleSince = null;
  let disposed = false;
  let started = false;
  let startPromise = null;
  let restController = null;
  let freshnessTimer = null;
  let connectedAt = null;

  const snapshot = () => ({
    state,
    settings,
    diagnostics,
    reconnectAttempt,
    nextRetryAt,
    online: isOnline(),
    disposed
  });

  const emit = () => onChange(snapshot());

  function start() {
    if (disposed) return Promise.reject(new Error('BTC Live runtime has been disposed'));
    if (startPromise) return startPromise;
    if (started) return Promise.resolve(snapshot());

    started = true;
    startPromise = initialize().finally(() => {
      startPromise = null;
    });
    return startPromise;
  }

  async function initialize() {
    const [loadedSettings, loadedDiagnostics] = await Promise.allSettled([
      loadSettingsValue(),
      loadDiagnosticsValue()
    ]);

    if (disposed) return snapshot();

    if (loadedSettings.status === 'fulfilled') settings = sanitizeSettings(loadedSettings.value);
    else onWarning('BTC Live settings could not be loaded', loadedSettings.reason);

    if (loadedDiagnostics.status === 'fulfilled') diagnostics = loadedDiagnostics.value;
    else onWarning('BTC Live session diagnostics could not be loaded', loadedDiagnostics.reason);

    state = applyConnectionEvent(state, CONNECTION_EVENT.LOAD);
    emit();

    refreshSnapshot();
    if (!isOnline()) {
      state = applyConnectionEvent(state, CONNECTION_EVENT.OFFLINE, 'You appear to be offline.');
      diagnostics = recordDisconnect(diagnostics, 'Browser reported offline.', now());
      persistDiagnosticsSafe();
      emit();
    } else {
      connectSocket(false);
    }
    freshnessTimer = setIntervalFn(checkFreshness, RUNTIME_TIMING.FRESHNESS_TICK_MS);
    return snapshot();
  }

  async function refreshSnapshot() {
    if (disposed) return;
    restController?.abort();
    const controller = new AbortController();
    restController = controller;

    try {
      const nextSnapshot = await fetchSnapshot({ signal: controller.signal });
      if (disposed || restController !== controller) return;
      state = applySnapshot(state, nextSnapshot);
      emit();
    } catch (error) {
      if (disposed || controller.signal.aborted || error?.name === 'AbortError') return;
      if (!state.hasInitialSnapshot && state.connectionStatus === CONNECTION_STATUS.LOADING) {
        state = applyConnectionEvent(state, CONNECTION_EVENT.CONNECT);
        emit();
      }
    } finally {
      if (restController === controller) restController = null;
    }
  }

  function connectSocket(isReconnect) {
    if (disposed || !isOnline()) return;

    clearReconnectTimer();
    clearSocketDataTimer();
    clearTickerDataTimer();

    const previousSocket = socket;
    const generation = ++socketGeneration;
    socket = null;
    staleSince = null;
    connectedAt = null;
    nextRetryAt = null;
    previousSocket?.close('Replacing connection');

    state = applyConnectionEvent(
      state,
      isReconnect ? CONNECTION_EVENT.RECONNECT : CONNECTION_EVENT.CONNECT
    );
    emit();

    let nextSocket;
    try {
      nextSocket = createSocket({
        onOpen() {
          if (!isCurrentSocket(generation, nextSocket)) return;
          connectedAt = now();
          diagnostics = recordConnected(diagnostics, connectedAt);
          persistDiagnosticsSafe();
          armSocketDataTimeout(generation, nextSocket);
          armTickerDataTimeout(generation, nextSocket);
          emit();
        },
        onTrade(trade) {
          if (!isCurrentSocket(generation, nextSocket)) return;
          const nextState = applyTrade(state, trade);
          if (nextState === state) return;
          markMarketData();
          state = applyHealthConnection(nextState);
          emit();
        },
        onTicker(ticker) {
          if (!isCurrentSocket(generation, nextSocket)) return;
          const nextState = applyTicker(state, ticker);
          if (nextState === state) return;
          markMarketData();
          armTickerDataTimeout(generation, nextSocket);
          state = applyHealthConnection(nextState);
          emit();
        },
        onBookTicker(book) {
          if (!isCurrentSocket(generation, nextSocket)) return;
          const nextState = applyBookTicker(state, book);
          if (nextState === state) return;
          markMarketData();
          state = applyHealthConnection(nextState);
          emit();
        },
        onClose(event) {
          if (!isCurrentSocket(generation, nextSocket)) return;
          socket = null;
          clearSocketDataTimer();
          clearTickerDataTimer();
          scheduleReconnect(formatCloseReason(event));
        },
        onError() {
          if (!isCurrentSocket(generation, nextSocket)) return;
          scheduleReconnect(
            Number.isFinite(state.lastValidUpdateAt)
              ? 'Live stream error. Reconnecting...'
              : 'Unable to establish a live connection.'
          );
        }
      });
    } catch (error) {
      onWarning('BTC Live WebSocket could not be created', error);
      if (generation === socketGeneration && !disposed) {
        scheduleReconnect('Unable to open the live stream.');
      }
      return;
    }

    socket = nextSocket;
  }

  function applyHealthConnection(nextState, at = now()) {
    const health = deriveFeedHealth(nextState, at);
    if (health.price === FEED_STATUS.STALE) {
      return applyConnectionEvent(nextState, CONNECTION_EVENT.DATA_STALE, 'Current price data may be delayed.');
    }
    if (health.price === FEED_STATUS.FRESH && health.stats === FEED_STATUS.STALE) {
      return applyConnectionEvent(nextState, CONNECTION_EVENT.DATA_DEGRADED, '24h market statistics may be delayed.');
    }
    return applyConnectionEvent(nextState, CONNECTION_EVENT.DATA_FRESH);
  }

  function markMarketData() {
    clearSocketDataTimer();
    if (connectedAt && now() - connectedAt >= 10_000) reconnectAttempt = 0;
    staleSince = null;
  }

  function armSocketDataTimeout(generation, targetSocket) {
    clearSocketDataTimer();
    socketDataTimer = setTimeoutFn(() => {
      socketDataTimer = null;
      if (!isCurrentSocket(generation, targetSocket)) return;
      scheduleReconnect('Connected, but no market data was received.');
    }, RUNTIME_TIMING.SOCKET_DATA_TIMEOUT_MS);
  }

  function clearSocketDataTimer() {
    if (!socketDataTimer) return;
    clearTimeoutFn(socketDataTimer);
    socketDataTimer = null;
  }

  function armTickerDataTimeout(generation, targetSocket) {
    clearTickerDataTimer();
    tickerDataTimer = setTimeoutFn(() => {
      tickerDataTimer = null;
      if (!isCurrentSocket(generation, targetSocket)) return;
      scheduleReconnect('24h market statistics stopped updating.');
    }, RUNTIME_TIMING.TICKER_DATA_TIMEOUT_MS);
  }

  function clearTickerDataTimer() {
    if (!tickerDataTimer) return;
    clearTimeoutFn(tickerDataTimer);
    tickerDataTimer = null;
  }

  function isCurrentSocket(generation, targetSocket) {
    return !disposed && generation === socketGeneration && socket === targetSocket;
  }

  function checkFreshness() {
    if (disposed) return;
    const at = now();

    if ([CONNECTION_STATUS.LIVE, CONNECTION_STATUS.DEGRADED, CONNECTION_STATUS.STALE].includes(state.connectionStatus)) {
      const nextState = applyHealthConnection(state, at);
      if (nextState.connectionStatus === CONNECTION_STATUS.STALE) {
        if (staleSince === null) staleSince = at;
      } else {
        staleSince = null;
      }
      state = nextState;
    }

    if (
      state.connectionStatus === CONNECTION_STATUS.STALE &&
      staleSince !== null &&
      at - staleSince >= RUNTIME_TIMING.STALE_RECONNECT_GRACE_MS
    ) {
      scheduleReconnect(`No current price event for more than ${STALE_AFTER_MS / 1000}s.`);
    }

    emit();
  }

  function scheduleReconnect(message = null, { immediate = false } = {}) {
    if (disposed) return;

    if (!isOnline()) {
      clearReconnectTimer();
      clearSocketDataTimer();
      clearTickerDataTimer();
      const oldSocket = socket;
      socket = null;
      socketGeneration += 1;
      nextRetryAt = null;
      oldSocket?.close('Offline');
      state = applyConnectionEvent(state, CONNECTION_EVENT.OFFLINE, 'You appear to be offline.');
      diagnostics = recordDisconnect(diagnostics, message || 'Browser reported offline.', now());
      persistDiagnosticsSafe();
      emit();
      return;
    }

    if (reconnectTimer) return;

    const delay = immediate ? 0 : reconnectDelay(reconnectAttempt);
    if (!immediate) reconnectAttempt += 1;
    nextRetryAt = now() + delay;
    connectedAt = null;
    clearSocketDataTimer();
    clearTickerDataTimer();

    const oldSocket = socket;
    socket = null;
    socketGeneration += 1;

    state = applyConnectionEvent(state, CONNECTION_EVENT.RECONNECT, message);
    diagnostics = recordReconnect(diagnostics, message || 'Live stream interrupted.', now());
    persistDiagnosticsSafe();
    emit();

    reconnectTimer = setTimeoutFn(() => {
      reconnectTimer = null;
      nextRetryAt = null;
      refreshSnapshot();
      connectSocket(true);
    }, delay);

    oldSocket?.close('Reconnect');
  }

  function retryNow() {
    if (disposed) return;
    reconnectAttempt = 0;
    nextRetryAt = null;
    clearReconnectTimer();
    refreshSnapshot();
    if (!isOnline()) {
      state = applyConnectionEvent(state, CONNECTION_EVENT.OFFLINE, 'You appear to be offline.');
      diagnostics = recordDisconnect(diagnostics, 'Manual retry while browser is offline.', now());
      persistDiagnosticsSafe();
      emit();
      return;
    }
    connectSocket(true);
  }

  function handleOffline() {
    scheduleReconnect('Browser reported offline.', { immediate: true });
  }

  function handleOnline() {
    retryNow();
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) return;
    clearTimeoutFn(reconnectTimer);
    reconnectTimer = null;
    nextRetryAt = null;
  }

  async function updateSettings(nextSettings) {
    const revision = ++settingsRevision;
    const sanitized = sanitizeSettings(nextSettings);
    settings = sanitized;
    emit();

    try {
      settings = sanitizeSettings(await persistSettings(sanitized));
      if (!disposed && revision === settingsRevision) emit();
    } catch (error) {
      onWarning('BTC Live settings could not be saved', error);
      if (revision !== settingsRevision || disposed) return settings;
      try {
        settings = await loadSettingsValue();
      } catch {
        settings = { ...DEFAULT_SETTINGS };
      }
      emit();
    }
    return settings;
  }

  async function resetSettings() {
    return updateSettings({ ...DEFAULT_SETTINGS });
  }

  function syncSettings(nextSettings) {
    if (disposed) return settings;
    settings = sanitizeSettings(nextSettings);
    emit();
    return settings;
  }

  async function resetDiagnostics() {
    try {
      diagnostics = await resetDiagnosticsValue();
    } catch (error) {
      onWarning('BTC Live session diagnostics could not be reset', error);
      diagnostics = createSessionDiagnostics(now());
    }
    emit();
    return diagnostics;
  }

  function persistDiagnosticsSafe() {
    persistDiagnostics(diagnostics).catch((error) => {
      onWarning('BTC Live session diagnostics could not be saved', error);
    });
  }

  function dispose(reason = 'View closed') {
    if (disposed) return;
    disposed = true;
    socketGeneration += 1;
    clearReconnectTimer();
    clearSocketDataTimer();
    clearTickerDataTimer();
    if (freshnessTimer) clearIntervalFn(freshnessTimer);
    freshnessTimer = null;
    restController?.abort();
    restController = null;
    socket?.close(reason);
    socket = null;
  }

  return {
    start,
    retryNow,
    handleOffline,
    handleOnline,
    updateSettings,
    resetSettings,
    syncSettings,
    resetDiagnostics,
    dispose,
    snapshot
  };
}

export function formatCloseReason(event) {
  const reason = typeof event?.reason === 'string' ? event.reason.trim() : '';
  if (reason) return `WebSocket closed: ${reason}`;
  if (Number.isInteger(event?.code)) return `WebSocket closed with code ${event.code}.`;
  return 'Live stream closed unexpectedly.';
}
