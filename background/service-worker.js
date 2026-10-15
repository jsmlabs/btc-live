import { createUpdateController, UPDATE_ALARM, UPDATE_MESSAGE } from '../app/software-updates.js';
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

const softwareUpdates = createUpdateController({ api });
let updateAlarmReconcile = Promise.resolve();
function scheduleUpdateChecks() {
  // Serialize reconciliation so startup and configuration changes cannot race.
  const next = updateAlarmReconcile.then(async () => {
    const state = await softwareUpdates.read();
    if (state.enabled) await api.alarms.create(UPDATE_ALARM, { periodInMinutes: 1440 });
    else await api.alarms.clear(UPDATE_ALARM);
  });
  updateAlarmReconcile = next.catch(() => {});
  return next;
}
api.runtime.onInstalled.addListener(() => {
  void scheduleUpdateChecks().catch(error => console.warn('BTC Live update scheduling failed', error));
  void softwareUpdates.check().catch(error => console.warn('BTC Live update check failed', error));
});
api.runtime.onStartup.addListener(() => {
  void scheduleUpdateChecks().catch(error => console.warn('BTC Live update scheduling failed', error));
  void softwareUpdates.check().catch(error => console.warn('BTC Live update check failed', error));
});
api.alarms.onAlarm.addListener(alarm => {
  if (alarm?.name === UPDATE_ALARM) void softwareUpdates.check().catch(error => console.warn('BTC Live update check failed', error));
});
api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== UPDATE_MESSAGE) return false;
  const run = message.action === 'check' ? softwareUpdates.check({ force: message.force === true })
    : message.action === 'configure' ? softwareUpdates.configure({
        enabled: message.enabled, channel: message.channel, dismissed: message.dismissed
      }).then(async state => { await scheduleUpdateChecks(); return state; })
    : message.action === 'read' ? softwareUpdates.read() : Promise.reject(Error('Unknown update command'));
  Promise.resolve(run).then(state => sendResponse({ ok: true, state }), () => sendResponse({ ok: false }));
  return true;
});
