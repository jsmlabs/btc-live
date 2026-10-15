import {
  DEFAULT_KLINE_LIMIT, KLINE_REFRESH_MS, fetchBtcKlines, intervalMs, normalizeKlineEvent
} from '../market/binance-klines.js';
import {
  DEFAULT_CHART_PREFERENCES, loadChartPreferences, createSerialChartPreferencesWriter, sanitizeChartPreferences
} from '../storage/chart-preferences.js';

export const CHART_STATUS = Object.freeze({
  IDLE: 'IDLE', LOADING: 'LOADING', SYNCING: 'SYNCING', READY: 'READY', PAUSED: 'PAUSED',
  STALE: 'STALE', RECONNECTING: 'RECONNECTING', OFFLINE: 'OFFLINE', ERROR: 'ERROR'
});
const KLINE_STREAM = 'wss://fstream.binance.com/market/ws/btcusdt@kline_';
export const MAX_CHART_CANDLES = 1600;
export const HISTORY_PAGE_LIMIT = 240;
export const CHART_STREAM_STALE_MS = 8_000;
export const CHART_STREAM_CONNECT_TIMEOUT_MS = 12_000;
export const CHART_HEALTH_TICK_MS = 1_000;

export function createBtcChartRuntime({
  onChange = () => {}, onWarning = () => {},
  fetchKlines = fetchBtcKlines, loadPreferences = loadChartPreferences,
  persistPreferences = createSerialChartPreferencesWriter(),
  createSocket = (url) => new WebSocket(url),
  setIntervalFn = setInterval, clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout,
  now = Date.now, limit = DEFAULT_KLINE_LIMIT, refreshMs = KLINE_REFRESH_MS
} = {}) {
  if (!Number.isSafeInteger(limit) || limit < 30 || limit > 500) throw new RangeError('limit must be an integer between 30 and 500');
  if (!Number.isFinite(refreshMs) || refreshMs < 5000) throw new RangeError('refreshMs must be at least 5000ms');
  if ([fetchKlines,loadPreferences,persistPreferences,createSocket,setIntervalFn,clearIntervalFn,setTimeoutFn,clearTimeoutFn,now].some(fn => typeof fn !== 'function')) {
    throw new TypeError('chart runtime data and timing adapters must be functions');
  }
  let preferences = { ...DEFAULT_CHART_PREFERENCES };
  let candles = [], status = CHART_STATUS.IDLE, errorMessage = null, lastLoadedAt = null;
  let lastStreamAt = null, lastExchangeEventAt = 0;
  let streamStartedAt = null, streamOpenedAt = null, healthTimer = null;
  let socket = null, socketGeneration = 0, reconnectTimer = null, reconnectDelay = 1500;
  let refreshTimer = null, requestController = null, requestGeneration = 0;
  let started = false, disposed = false, recoveryPending = false, visible = true;
  let historyLoading = false, historyError = null, historyEnd = false, historyController = null, historyGeneration = 0;
  function cancelHistory() { ++historyGeneration; historyController?.abort(); historyController=null; historyLoading=false; historyError=null; historyEnd=false; }
  function mergeCandles(left,right) {
    const merged = new Map();
    for (const candle of left) merged.set(candle.openTime,candle);
    for (const candle of right) merged.set(candle.openTime,candle);
    return [...merged.values()].sort((a,b)=>a.openTime-b.openTime).slice(-MAX_CHART_CANDLES);
  }

  function snapshot() {
    return { preferences: { ...preferences }, candles: candles.map(c => ({...c})), status,
      errorMessage, lastLoadedAt, lastStreamAt, history: { loading:historyLoading, error:historyError, reachedStart:historyEnd, capped:candles.length>=MAX_CHART_CANDLES }, source: 'Binance Futures Klines (REST + WebSocket)', disposed };
  }
  function emit() { if (!disposed) onChange(snapshot()); }
  function closeStream() {
    ++socketGeneration;
    streamStartedAt = streamOpenedAt = null;
    if (reconnectTimer !== null) clearTimeoutFn(reconnectTimer);
    reconnectTimer = null;
    const old = socket; socket = null;
    if (old) { old.onopen = old.onmessage = old.onerror = old.onclose = null; try { old.close(); } catch {} }
  }
  function reconnect() {
    if (disposed || !started || !visible || reconnectTimer !== null) return;
    lastStreamAt = null;
    status = candles.length ? CHART_STATUS.RECONNECTING : CHART_STATUS.SYNCING;
    emit();
    reconnectTimer = setTimeoutFn(() => {
      reconnectTimer = null;
      openStream();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
  }
  function openStream() {
    if (!started || disposed || !visible || socket || globalThis.navigator?.onLine === false) return;
    const generation = ++socketGeneration, selectedInterval = preferences.interval;
    streamStartedAt = now(); streamOpenedAt = null;
    try {
      const stream = createSocket(`${KLINE_STREAM}${selectedInterval}`);
      socket = stream;
      stream.onopen = () => {
        if (generation !== socketGeneration || disposed) return;
        reconnectDelay = 1500;
        streamOpenedAt = now();
        lastStreamAt = null; lastExchangeEventAt = 0;
        status = CHART_STATUS.SYNCING;
        emit();
        reload({ background: true }).catch(e => onWarning('BTC Live chart websocket resync failed', e));
      };
      stream.onmessage = (message) => {
        if (generation !== socketGeneration || disposed || selectedInterval !== preferences.interval) return;
        let event;
        try { event = normalizeKlineEvent(JSON.parse(message.data), selectedInterval); }
        catch { return; }
        if (!event || event.eventAt <= lastExchangeEventAt) return;
        const last = candles.at(-1), next = event.candle, duration = intervalMs(selectedInterval);
        if (!last || (next.openTime !== last.openTime && next.openTime !== last.openTime + duration)) {
          if (!recoveryPending) {
            recoveryPending = true; status = CHART_STATUS.SYNCING; emit();
            reload({ background: true }).catch(e => onWarning('BTC Live chart sequence recovery failed', e))
              .finally(() => { recoveryPending = false; });
          }
          return;
        }
        if (last.openTime === next.openTime && last.closed === true && !event.closed) return;
        lastExchangeEventAt = event.eventAt;
        lastStreamAt = now();
        if (next.openTime === last.openTime) candles = [...candles.slice(0,-1), { ...next, closed: event.closed }];
        else candles = [...candles, { ...next, closed: event.closed }].slice(-MAX_CHART_CANDLES);
        status = CHART_STATUS.READY;
        errorMessage = null;
        emit();
      };
      const lost = () => {
        if (generation !== socketGeneration || disposed) return;
        socket = null;
        try { stream.close(); } catch {}
        reconnect();
      };
      stream.onerror = lost;
      stream.onclose = lost;
    } catch (error) {
      onWarning('BTC Live chart Kline WebSocket could not open', error);
      socket = null; reconnect();
    }
  }

  async function start() {
    if (started || disposed) return snapshot();
    started = true;
    try { preferences = sanitizeChartPreferences(await loadPreferences()); }
    catch (e) { onWarning('BTC Live chart preferences could not be loaded', e); }
    emit();
    if (visible) await reload();
    else { status = CHART_STATUS.PAUSED; emit(); }
    if (!disposed) {
      if (globalThis.navigator?.onLine === false) { status = CHART_STATUS.OFFLINE; emit(); }
      else openStream();
      // Watch feed health independently of the slower REST reconciliation cadence.
      healthTimer = setIntervalFn(() => {
        if (!socket || disposed || !visible || globalThis.navigator?.onLine === false) return;
        const time = now();
        const connectTimedOut = streamOpenedAt === null && streamStartedAt !== null &&
          time - streamStartedAt > CHART_STREAM_CONNECT_TIMEOUT_MS;
        const firstEventTimedOut = streamOpenedAt !== null && lastStreamAt === null &&
          time - streamOpenedAt > CHART_STREAM_CONNECT_TIMEOUT_MS;
        const streamStale = lastStreamAt !== null && time - lastStreamAt > CHART_STREAM_STALE_MS;
        if (connectTimedOut || firstEventTimedOut || streamStale) {
          closeStream();
          reconnect();
        }
      }, CHART_HEALTH_TICK_MS);
      refreshTimer = setIntervalFn(() => {
        if (!visible || status === CHART_STATUS.OFFLINE) return;
        reload({background:true}).catch(e => onWarning('BTC Live chart refresh failed', e));
      }, refreshMs);
    }
    return snapshot();
  }

  async function reload({ background = false } = {}) {
    if (disposed || !visible) return snapshot();
    const generation = ++requestGeneration, interval = preferences.interval, requestStartedAt = now();
    requestController?.abort();
    const controller = new AbortController(); requestController = controller;
    if (!background || !candles.length) { status = CHART_STATUS.LOADING; errorMessage = null; emit(); }
    try {
      const result = await fetchKlines({ interval, limit, signal:controller.signal });
      if (disposed || requestController !== controller || generation !== requestGeneration || interval !== preferences.interval) return snapshot();
      // In a racing REST/WebSocket response prefer the most recent authoritative stream candle.
      if (!Array.isArray(result) || !result.length) throw new Error('Empty Binance candle snapshot');
      const oldLast = candles.at(-1);
      const newLast = result.at(-1);
      let next = result.slice(-limit).map(c => ({ ...c, closed: c.closeTime < now() }));
      if (oldLast && lastStreamAt !== null && newLast &&
        (oldLast.openTime > newLast.openTime || oldLast.openTime === newLast.openTime && lastStreamAt >= requestStartedAt)) {
        if (oldLast.openTime === newLast.openTime) next[next.length-1] = oldLast;
        else if (oldLast.openTime - newLast.openTime === intervalMs(interval)) next = [...next, oldLast].slice(-MAX_CHART_CANDLES);
      }
      // Preserve older verified candles when REST refreshes the recent window.
      candles = mergeCandles(candles.filter(c => c.openTime < next[0].openTime), next);
      lastLoadedAt = now();
      // REST snapshots alone never establish LIVE; only recent accepted WebSocket Klines do.
      status = status === CHART_STATUS.OFFLINE || globalThis.navigator?.onLine === false
        ? CHART_STATUS.OFFLINE
        : lastStreamAt !== null && now()-lastStreamAt <= CHART_STREAM_STALE_MS ? CHART_STATUS.READY : CHART_STATUS.SYNCING;
      errorMessage = null; emit();
    } catch (e) {
      if (disposed || controller.signal.aborted || e?.name === 'AbortError') return snapshot();
      status = status === CHART_STATUS.OFFLINE ? CHART_STATUS.OFFLINE
        : candles.length ? CHART_STATUS.STALE : CHART_STATUS.ERROR;
      errorMessage = candles.length ? 'Snapshot refresh delayed.' : 'Unable to load exchange candles.';
      emit();
      if (background) onWarning('BTC Live chart background refresh failed', e);
    } finally { if (requestController === controller) requestController = null; }
    return snapshot();
  }

  async function loadOlder() {
    if (!started || disposed || !visible || historyLoading || historyEnd || !candles.length || candles.length >= MAX_CHART_CANDLES) return snapshot();
    const generation=++historyGeneration, interval=preferences.interval;
    const oldest=candles[0].openTime;
    if (oldest <= 0) { historyEnd=true;emit();return snapshot(); }
    const controller=new AbortController();historyController=controller;historyLoading=true;historyError=null;emit();
    try {
      const page=await fetchKlines({interval,limit:HISTORY_PAGE_LIMIT,endTime:oldest-1,signal:controller.signal});
      if (disposed || generation !== historyGeneration || interval !== preferences.interval || controller.signal.aborted) return snapshot();
      if (!Array.isArray(page) || page.some(c=>!Number.isSafeInteger(c.openTime) || c.openTime>=oldest) ||
        page.some((c,i)=>i>0 && c.openTime<=page[i-1].openTime)) throw new Error('Invalid historical kline page');
      const earlier=page.filter(c=>c.openTime<oldest).map(c=>({...c,closed:true}));
      if (!earlier.length || earlier.length<HISTORY_PAGE_LIMIT) historyEnd=true;
      if (earlier.length) candles=mergeCandles(earlier,candles);
    } catch(e) {
      if (generation === historyGeneration && !controller.signal.aborted) {
        historyError='Historical candles unavailable; retry loading older data.';
        onWarning('BTC Live chart historical pagination failed',e);
      }
    } finally {
      if (generation === historyGeneration) {historyLoading=false;historyController=null;emit();}
    }
    return snapshot();
  }
  function changeInterval() {
    const selectedInterval = preferences.interval;
    closeStream();
    cancelHistory();
    lastStreamAt = null; lastExchangeEventAt = 0; candles = []; recoveryPending = false;
    requestController?.abort();
    if (!visible) { status = CHART_STATUS.PAUSED; emit(); return; }
    reload().then(() => { if (!disposed && started && preferences.interval === selectedInterval) openStream(); })
      .catch(e => onWarning('BTC Live chart interval change failed', e));
  }
  async function updatePreferences(patch) {
    if (disposed) return preferences;
    const before = preferences.interval;
    preferences = sanitizeChartPreferences({ ...preferences, ...patch }); emit();
    if (before !== preferences.interval) changeInterval();
    try { await persistPreferences(preferences); }
    catch (e) { onWarning('BTC Live chart preferences could not be saved', e); }
    return { ...preferences };
  }
  function syncPreferences(value) {
    if (disposed) return preferences;
    const before = preferences.interval;
    preferences = sanitizeChartPreferences(value); emit();
    if (before !== preferences.interval) changeInterval();
    return { ...preferences };
  }
  // Retained as an API compatibility hook; ticker trades must never modify exchange OHLCV.
  function ingestMarketState() {}
  function handleHidden() {
    if (disposed || !visible) return;
    visible = false;
    closeStream();
    lastStreamAt = null;
    requestController?.abort();
    status = CHART_STATUS.PAUSED;
    emit();
  }
  function handleVisible() {
    if (disposed || visible) return;
    visible = true;
    if (!started) return;
    if (globalThis.navigator?.onLine === false) { status = CHART_STATUS.OFFLINE; emit(); return; }
    status = CHART_STATUS.SYNCING;
    emit();
    reload({ background: true }).then(() => { if (!disposed && visible) openStream(); })
      .catch(e => onWarning('BTC Live chart foreground resync failed', e));
  }
  function handleOffline() {
    if (disposed || !started) return;
    closeStream();
    status = CHART_STATUS.OFFLINE;
    emit();
  }
  function handleOnline() {
    if (disposed || !started) return;
    if (status !== CHART_STATUS.OFFLINE) return;
    if (!visible) { status = CHART_STATUS.PAUSED; emit(); return; }
    status = CHART_STATUS.SYNCING;
    emit();
    reload({ background: true }).then(() => {
      if (!disposed && status !== CHART_STATUS.OFFLINE) openStream();
    }).catch(e => onWarning('BTC Live chart online resync failed', e));
  }
  function dispose() {
    if (disposed) return;
    disposed = true; ++requestGeneration;
    requestController?.abort(); requestController=null;
    cancelHistory();
    closeStream();
    if (refreshTimer !== null) clearIntervalFn(refreshTimer);
    if (healthTimer !== null) clearIntervalFn(healthTimer);
    refreshTimer=healthTimer=null;
  }
  return {start,reload,loadOlder,updatePreferences,syncPreferences,ingestMarketState,handleHidden,handleVisible,handleOffline,handleOnline,snapshot,dispose};
}
