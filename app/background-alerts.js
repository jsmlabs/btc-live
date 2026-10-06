import { createNotificationManager } from './notifications.js';
import { fetchBtcSnapshot } from '../market/binance-rest.js';
import { loadAlertTargets } from '../storage/alert-targets.js';
import { loadSettings } from '../storage/settings.js';

export const BACKGROUND_ALERT_ALARM = 'btc-live-background-alerts';
export const BACKGROUND_ALERT_PERIOD_MINUTES = 1;

export function hasEnabledPriceAlert(settings, targets = []) {
  return Boolean(
    settings?.notifyPriceMove ||
    (settings?.notifyPriceAbove && Number.isFinite(settings?.priceAboveTarget)) ||
    (settings?.notifyPriceBelow && Number.isFinite(settings?.priceBelowTarget)) ||
    targets.some((target) => target?.enabled)
  );
}

export function shouldRunBackgroundAlerts(settings, targets = []) {
  return Boolean(settings?.notificationsEnabled && settings?.backgroundAlertsEnabled && hasEnabledPriceAlert(settings, targets));
}

export function createBackgroundAlertController({
  loadSettingsValue = loadSettings,
  loadTargetsValue = loadAlertTargets,
  fetchSnapshot = fetchBtcSnapshot,
  notificationManager = createNotificationManager({ source: 'background' }),
  alarms = (globalThis.browser ?? globalThis.chrome)?.alarms ?? null,
  onWarning = (...args) => console.warn(...args)
} = {}) {
  let activeRun = null;

  function runOnce() {
    if (activeRun) return activeRun;
    activeRun = executeRun().finally(() => { activeRun = null; });
    return activeRun;
  }

  async function executeRun() {
    const [settings, targets] = await Promise.all([loadSettingsValue(), loadTargetsValue()]);
    if (!shouldRunBackgroundAlerts(settings, targets)) return { status: 'disabled' };

    try {
      const market = await fetchSnapshot({ timeoutMs: 5000 });
      await notificationManager.observe({
        settings: { ...settings, notifyConnectionIssues: false },
        state: { ...market, connectionStatus: 'LIVE' }
      });
      return { status: 'ok', currentPrice: market.currentPrice };
    } catch (error) {
      onWarning('BTC Live background alert check failed', error);
      return { status: 'error', error };
    }
  }

  async function reconcile() {
    const [settings, targets] = await Promise.all([loadSettingsValue(), loadTargetsValue()]);
    if (!alarms?.create || !alarms?.clear) return { enabled: false, supported: false };

    if (shouldRunBackgroundAlerts(settings, targets)) {
      await alarms.create(BACKGROUND_ALERT_ALARM, { periodInMinutes: BACKGROUND_ALERT_PERIOD_MINUTES });
      return { enabled: true, supported: true };
    }

    await alarms.clear(BACKGROUND_ALERT_ALARM);
    return { enabled: false, supported: true };
  }

  function dispose() {
    notificationManager.dispose?.();
  }

  return { runOnce, reconcile, dispose };
}
