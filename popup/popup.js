import { createBtcLiveRuntime } from '../app/runtime.js';
import { createNativeNotification, createNotificationManager } from '../app/notifications.js';
import { ALERT_HISTORY_STORAGE_KEY } from '../storage/alert-history.js';
import { ALERT_TARGETS_STORAGE_KEY } from '../storage/alert-targets.js';
import { createAlertCenterController } from '../ui/alert-center.js';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, sanitizeSettings } from '../storage/settings.js';
import { renderMarket, renderSettings } from '../ui/render.js';

let latest = null;
const api = globalThis.browser ?? globalThis.chrome ?? null;
let cleanedUp = false;
const notificationManager = createNotificationManager({ source: 'popup' });
const alertCenter = createAlertCenterController({
  ids: {
    form: 'settingTargetForm', direction: 'settingTargetDirection', price: 'settingTargetPrice', label: 'settingTargetLabel',
    feedback: 'settingTargetFeedback', targetList: 'settingTargetList', targetCount: 'settingTargetCount',
    historyList: 'settingHistoryList', historyCount: 'settingHistoryCount', clearHistory: 'settingClearHistory'
  }
});

const runtime = createBtcLiveRuntime({
  onChange(snapshot) {
    latest = snapshot;
    renderSnapshot(snapshot);
    notificationManager.observe(snapshot);
  }
});

function renderSnapshot(snapshot) {
  const now = Date.now();
  renderMarket(snapshot.state, snapshot.settings, now, { nextRetryAt: snapshot.nextRetryAt });
  renderSettings(snapshot.settings);
}

function openSettings() {
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');
  mainView.hidden = true;
  settingsView.hidden = false;
  document.getElementById('closeSettingsButton').focus();
}

function closeSettings() {
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');
  if (settingsView.hidden) return;
  settingsView.hidden = true;
  mainView.hidden = false;
  document.getElementById('settingsButton').focus();
}

function openDashboard() {
  const url = api?.runtime?.getURL
    ? api.runtime.getURL('dashboard/dashboard.html')
    : '../dashboard/dashboard.html';

  if (api?.tabs?.create) {
    api.tabs.create({ url }).catch?.((error) => console.warn('BTC Live dashboard could not be opened', error));
    return;
  }
  window.open(url, '_blank', 'noopener');
}


function handleStorageChange(changes, areaName) {
  if (areaName !== 'local') return;
  if (changes?.[SETTINGS_STORAGE_KEY]) runtime.syncSettings(sanitizeSettings(changes[SETTINGS_STORAGE_KEY].newValue));
  if (changes?.[ALERT_TARGETS_STORAGE_KEY]) alertCenter.refreshTargets().catch((error) => console.warn('BTC Live target UI refresh failed', error));
  if (changes?.[ALERT_HISTORY_STORAGE_KEY]) alertCenter.refreshHistory().catch((error) => console.warn('BTC Live history UI refresh failed', error));
}

function bindUi() {
  document.getElementById('dashboardButton').addEventListener('click', openDashboard);
  document.getElementById('settingsButton').addEventListener('click', openSettings);
  document.getElementById('closeSettingsButton').addEventListener('click', closeSettings);
  document.getElementById('retryButton').addEventListener('click', () => runtime.retryNow());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettings();
  });

  for (const [id, key] of [
    ['settingCompact', 'compactLayout'],
    ['settingBidAsk', 'showBidAsk'],
    ['settingVolume', 'showVolume'],
    ['settingRange', 'showRange'],
    ['settingAnimation', 'priceAnimation'],
    ['settingNotifications', 'notificationsEnabled'],
    ['settingBackgroundAlerts', 'backgroundAlertsEnabled'],
    ['settingNotifyPrice', 'notifyPriceMove'],
    ['settingNotifyConnection', 'notifyConnectionIssues']
  ]) {
    document.getElementById(id).addEventListener('change', (event) => {
      const settings = latest?.settings ?? DEFAULT_SETTINGS;
      runtime.updateSettings({ ...settings, [key]: event.target.checked });
    });
  }

  document.getElementById('settingPriceThreshold').addEventListener('change', (event) => {
    const settings = latest?.settings ?? DEFAULT_SETTINGS;
    runtime.updateSettings({ ...settings, priceMovePercentThreshold: Number(event.target.value) });
  });


  document.getElementById('settingNotificationCooldown').addEventListener('change', (event) => {
    const settings = latest?.settings ?? DEFAULT_SETTINGS;
    runtime.updateSettings({ ...settings, notificationCooldownSeconds: Number(event.target.value) });
  });

  document.getElementById('testNotificationButton').addEventListener('click', () => {
    createNativeNotification({ id: 'btc-live-test', title: 'BTC Live notifications', message: 'Browser notifications are working.' })
      .catch((error) => console.warn('BTC Live test notification failed', error));
  });

  document.getElementById('resetSettingsButton').addEventListener('click', () => runtime.resetSettings());
  window.addEventListener('offline', runtime.handleOffline);
  window.addEventListener('online', runtime.handleOnline);
  api?.storage?.onChanged?.addListener(handleStorageChange);
}

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  window.removeEventListener('offline', runtime.handleOffline);
  window.removeEventListener('online', runtime.handleOnline);
  api?.storage?.onChanged?.removeListener(handleStorageChange);
  alertCenter.dispose();
  notificationManager.dispose();
  runtime.dispose('Popup closed');
}

bindUi();
alertCenter.refresh().catch((error) => console.warn('BTC Live alert center initialization failed', error));
window.addEventListener('pagehide', cleanup, { once: true });
window.addEventListener('unload', cleanup, { once: true });

runtime.start().catch((error) => {
  console.error('BTC Live initialization failed', error);
});
