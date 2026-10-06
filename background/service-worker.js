import { BACKGROUND_ALERT_ALARM, createBackgroundAlertController } from '../app/background-alerts.js';
import { ALERT_TARGETS_STORAGE_KEY } from '../storage/alert-targets.js';
import { SETTINGS_STORAGE_KEY } from '../storage/settings.js';

const api = globalThis.browser ?? globalThis.chrome;
const controller = createBackgroundAlertController();

api.runtime.onInstalled.addListener(() => {
  controller.reconcile().then(() => controller.runOnce()).catch((error) => console.warn('BTC Live background initialization failed', error));
});

api.runtime.onStartup.addListener(() => {
  controller.reconcile().catch((error) => console.warn('BTC Live background startup failed', error));
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name !== BACKGROUND_ALERT_ALARM) return;
  controller.runOnce().catch((error) => console.warn('BTC Live background alert failed', error));
});

api.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || (!changes?.[SETTINGS_STORAGE_KEY] && !changes?.[ALERT_TARGETS_STORAGE_KEY])) return;
  controller.reconcile().then(() => controller.runOnce()).catch((error) => console.warn('BTC Live background alert sync failed', error));
});
