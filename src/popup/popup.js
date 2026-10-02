import { fetchBtcSnapshot } from '../market/binance-rest.js';
import { createBinanceSocket } from '../market/binance-websocket.js';
import {
  CONNECTION_STATUS,
  STALE_AFTER_MS,
  applySnapshot,
  applyTicker,
  applyTrade,
  createInitialMarketState,
  withStatus
} from '../market/market-state.js';
import { loadSettings, saveSettings } from '../storage/settings.js';
import { renderMarket, renderSettings } from '../ui/render.js';
import { reconnectDelay } from '../utils/backoff.js';

let state = createInitialMarketState();
let settings;
let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let staleSince = null;
let disposed = false;
let restController = null;
let freshnessTimer = null;
let connectedAt = null;

const render = () => renderMarket(state, settings, Date.now());

async function main() {
  settings = await loadSettings();
  bindUi();
  renderSettings(settings);
  state = withStatus(state, CONNECTION_STATUS.LOADING);
  render();

  refreshSnapshot();
  connectSocket(false);
  freshnessTimer = setInterval(checkFreshness, 1000);
}

async function refreshSnapshot() {
  restController?.abort();
  restController = new AbortController();
  try {
    const snapshot = await fetchBtcSnapshot({ signal: restController.signal });
    if (disposed) return;
    state = applySnapshot(state, snapshot);
    render();
  } catch (error) {
    if (disposed || error?.name === 'AbortError') return;
    if (!state.hasInitialSnapshot && state.connectionStatus === CONNECTION_STATUS.LOADING) {
      state = withStatus(state, CONNECTION_STATUS.CONNECTING);
      render();
    }
  }
}

function connectSocket(isReconnect) {
  if (disposed) return;
  clearReconnectTimer();
  socket?.close('Replacing connection');
  socket = null;
  staleSince = null;

  state = withStatus(state, isReconnect ? CONNECTION_STATUS.RECONNECTING : CONNECTION_STATUS.CONNECTING);
  render();

  socket = createBinanceSocket({
    onOpen() {
      if (disposed) return;
      connectedAt = Date.now();
      state = withStatus(state, CONNECTION_STATUS.CONNECTING);
      render();
    },
    onTrade(trade) {
      if (disposed) return;
      state = withStatus(applyTrade(state, trade), CONNECTION_STATUS.LIVE);
      if (connectedAt && Date.now() - connectedAt >= 10_000) reconnectAttempt = 0;
      staleSince = null;
      render();
    },
    onTicker(ticker) {
      if (disposed) return;
      state = withStatus(applyTicker(state, ticker), CONNECTION_STATUS.LIVE);
      if (connectedAt && Date.now() - connectedAt >= 10_000) reconnectAttempt = 0;
      staleSince = null;
      render();
    },
    onClose() {
      if (!disposed) scheduleReconnect();
    },
    onError() {
      if (!disposed && !Number.isFinite(state.lastValidUpdateAt)) {
        state = withStatus(state, CONNECTION_STATUS.RECONNECTING, 'Unable to establish a live connection.');
        render();
      }
    }
  });
}

function checkFreshness() {
  if (disposed) return;
  const now = Date.now();

  if (state.connectionStatus === CONNECTION_STATUS.LIVE && Number.isFinite(state.lastValidUpdateAt)) {
    if (now - state.lastValidUpdateAt > STALE_AFTER_MS) {
      staleSince = now;
      state = withStatus(state, CONNECTION_STATUS.STALE);
    }
  } else if (state.connectionStatus === CONNECTION_STATUS.STALE && staleSince && now - staleSince >= 2000) {
    scheduleReconnect('Market data may be delayed.');
  }

  render();
}

function scheduleReconnect(message = null) {
  if (disposed || reconnectTimer) return;

  const delay = reconnectDelay(reconnectAttempt);
  reconnectAttempt += 1;
  connectedAt = null;
  const oldSocket = socket;
  socket = null;

  state = withStatus(
    state,
    Number.isFinite(state.lastValidUpdateAt) ? CONNECTION_STATUS.RECONNECTING : CONNECTION_STATUS.OFFLINE,
    message
  );
  render();

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    refreshSnapshot();
    connectSocket(true);
  }, delay);

  oldSocket?.close('Reconnect');
}

function clearReconnectTimer() {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function bindUi() {
  const settingsButton = document.getElementById('settingsButton');
  const closeSettingsButton = document.getElementById('closeSettingsButton');
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');

  settingsButton.addEventListener('click', () => {
    mainView.hidden = true;
    settingsView.hidden = false;
    closeSettingsButton.focus();
  });

  closeSettingsButton.addEventListener('click', () => {
    settingsView.hidden = true;
    mainView.hidden = false;
    settingsButton.focus();
  });

  for (const [id, key] of [
    ['settingBidAsk', 'showBidAsk'],
    ['settingVolume', 'showVolume'],
    ['settingAnimation', 'priceAnimation']
  ]) {
    document.getElementById(id).addEventListener('change', async (event) => {
      settings = await saveSettings({ ...settings, [key]: event.target.checked });
      renderSettings(settings);
      render();
    });
  }
}

function cleanup() {
  if (disposed) return;
  disposed = true;
  clearReconnectTimer();
  if (freshnessTimer) clearInterval(freshnessTimer);
  freshnessTimer = null;
  restController?.abort();
  restController = null;
  socket?.close('Popup closed');
  socket = null;
}

window.addEventListener('pagehide', cleanup, { once: true });
window.addEventListener('unload', cleanup, { once: true });

main().catch((error) => {
  console.error('BTC Live initialization failed', error);
  if (!settings) settings = { showBidAsk: true, showVolume: true, priceAnimation: true };
  state = withStatus(state, CONNECTION_STATUS.ERROR, 'Unable to initialize BTC Live.');
  render();
});
