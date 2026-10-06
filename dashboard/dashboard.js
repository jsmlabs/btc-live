import { createBtcChartRuntime } from '../app/chart-runtime.js';
import { createBtcLiveRuntime } from '../app/runtime.js';
import { createNativeNotification, createNotificationManager } from '../app/notifications.js';
import { ALERT_HISTORY_STORAGE_KEY } from '../storage/alert-history.js';
import { ALERT_TARGETS_STORAGE_KEY } from '../storage/alert-targets.js';
import { createAlertCenterController } from '../ui/alert-center.js';
import { CHART_PREFERENCES_STORAGE_KEY, sanitizeChartPreferences } from '../storage/chart-preferences.js';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, sanitizeSettings } from '../storage/settings.js';
import { renderBtcChart } from '../ui/chart.js';
import { renderDashboard } from '../ui/dashboard-render.js';

let latest = null;
let latestChart = null;
const api = globalThis.browser ?? globalThis.chrome ?? null;
let cleanedUp = false;
const notificationManager = createNotificationManager({ source: 'dashboard' });
const alertCenter = createAlertCenterController({
  ids: {
    form: 'dashboardTargetForm', direction: 'dashboardTargetDirection', price: 'dashboardTargetPrice', label: 'dashboardTargetLabel',
    feedback: 'dashboardTargetFeedback', targetList: 'dashboardTargetList', targetCount: 'dashboardTargetCount',
    historyList: 'dashboardHistoryList', historyCount: 'dashboardHistoryCount', clearHistory: 'dashboardClearHistory'
  }
});

const chartRuntime = createBtcChartRuntime({
  onChange(snapshot) {
    latestChart = snapshot;
    renderBtcChart(snapshot, latest?.state, Date.now());
  }
});

const runtime = createBtcLiveRuntime({
  onChange(snapshot) {
    latest = snapshot;
    renderDashboard(snapshot, Date.now());
    notificationManager.observe(snapshot);
    chartRuntime.ingestMarketState(snapshot.state);
    if (latestChart) renderBtcChart(latestChart, snapshot.state, Date.now());
  }
});

function bindSettings() {
  for (const [id, key] of [
    ['dashboardSettingCompact', 'compactLayout'],
    ['dashboardSettingBidAsk', 'showBidAsk'],
    ['dashboardSettingVolume', 'showVolume'],
    ['dashboardSettingRange', 'showRange'],
    ['dashboardSettingAnimation', 'priceAnimation'],
    ['dashboardSettingNotifications', 'notificationsEnabled'],
    ['dashboardSettingBackgroundAlerts', 'backgroundAlertsEnabled'],
    ['dashboardSettingNotifyPrice', 'notifyPriceMove'],
    ['dashboardSettingNotifyConnection', 'notifyConnectionIssues']
  ]) {
    document.getElementById(id).addEventListener('change', (event) => {
      const settings = latest?.settings ?? DEFAULT_SETTINGS;
      runtime.updateSettings({ ...settings, [key]: event.target.checked });
    });
  }
  document.getElementById('dashboardSettingPriceThreshold').addEventListener('change', (event) => {
    const settings = latest?.settings ?? DEFAULT_SETTINGS;
    runtime.updateSettings({ ...settings, priceMovePercentThreshold: Number(event.target.value) });
  });


  document.getElementById('dashboardSettingNotificationCooldown').addEventListener('change', (event) => {
    const settings = latest?.settings ?? DEFAULT_SETTINGS;
    runtime.updateSettings({ ...settings, notificationCooldownSeconds: Number(event.target.value) });
  });
}

function bindChart() {
  for (const [id, interval] of [
    ['dashboardChartInterval1m', '1m'],
    ['dashboardChartInterval5m', '5m'],
    ['dashboardChartInterval15m', '15m']
  ]) {
    document.getElementById(id).addEventListener('click', () => chartRuntime.updatePreferences({ interval }));
  }

  document.getElementById('dashboardChartCandles').addEventListener('click', () => {
    chartRuntime.updatePreferences({ mode: 'candles' });
  });
  document.getElementById('dashboardChartLine').addEventListener('click', () => {
    chartRuntime.updatePreferences({ mode: 'line' });
  });
  document.getElementById('dashboardChartVolume').addEventListener('change', (event) => {
    chartRuntime.updatePreferences({ showVolume: event.target.checked });
  });
  document.getElementById('dashboardChartRetry').addEventListener('click', () => chartRuntime.reload());
}

function handleStorageChange(changes, areaName) {
  if (areaName !== 'local') return;
  if (changes?.[SETTINGS_STORAGE_KEY]) {
    runtime.syncSettings(sanitizeSettings(changes[SETTINGS_STORAGE_KEY].newValue));
  }
  if (changes?.[ALERT_TARGETS_STORAGE_KEY]) alertCenter.refreshTargets().catch((error) => console.warn('BTC Live target UI refresh failed', error));
  if (changes?.[ALERT_HISTORY_STORAGE_KEY]) alertCenter.refreshHistory().catch((error) => console.warn('BTC Live history UI refresh failed', error));
  if (changes?.[CHART_PREFERENCES_STORAGE_KEY]) {
    chartRuntime.syncPreferences(sanitizeChartPreferences(changes[CHART_PREFERENCES_STORAGE_KEY].newValue));
  }
}

function bindUi() {
  document.getElementById('dashboardRetryButton').addEventListener('click', () => runtime.retryNow());
  document.getElementById('dashboardResetSettings').addEventListener('click', () => runtime.resetSettings());
  document.getElementById('dashboardResetDiagnostics').addEventListener('click', () => runtime.resetDiagnostics());
  bindSettings();
  bindChart();
  document.getElementById('dashboardTestNotification').addEventListener('click', () => {
    createNativeNotification({ id: 'btc-live-test', title: 'BTC Live notifications', message: 'Browser notifications are working.' })
      .catch((error) => console.warn('BTC Live test notification failed', error));
  });
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
  chartRuntime.dispose();
  alertCenter.dispose();
  notificationManager.dispose();
  runtime.dispose('Dashboard closed');
}

bindUi();
alertCenter.refresh().catch((error) => console.warn('BTC Live alert center initialization failed', error));
window.addEventListener('pagehide', cleanup, { once: true });
window.addEventListener('unload', cleanup, { once: true });

Promise.allSettled([runtime.start(), chartRuntime.start()]).then((results) => {
  for (const result of results) {
    if (result.status === 'rejected') console.error('BTC Live dashboard initialization failed', result.reason);
  }
});
