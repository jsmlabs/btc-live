import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BACKGROUND_ALERT_ALARM,
  BACKGROUND_ALERT_PERIOD_MINUTES,
  createBackgroundAlertController,
  hasEnabledPriceAlert,
  shouldRunBackgroundAlerts
} from '../app/background-alerts.js';
import { DEFAULT_SETTINGS } from '../storage/settings.js';

test('background alerts require notifications, background mode and price alerts', () => {
  assert.equal(shouldRunBackgroundAlerts(DEFAULT_SETTINGS), false);
  assert.equal(shouldRunBackgroundAlerts({ ...DEFAULT_SETTINGS, notificationsEnabled: true }), true);
  assert.equal(shouldRunBackgroundAlerts({ ...DEFAULT_SETTINGS, notificationsEnabled: true, backgroundAlertsEnabled: false }), false);
  assert.equal(shouldRunBackgroundAlerts({ ...DEFAULT_SETTINGS, notificationsEnabled: true, notifyPriceMove: false }), false);
  assert.equal(hasEnabledPriceAlert({ ...DEFAULT_SETTINGS, notifyPriceMove: false, notifyPriceAbove: true, priceAboveTarget: 100000 }), true);
  assert.equal(shouldRunBackgroundAlerts({ ...DEFAULT_SETTINGS, notificationsEnabled: true, notifyPriceMove: false, notifyPriceAbove: true, priceAboveTarget: 100000 }), true);
});

test('background controller reconciles the periodic alarm', async () => {
  const calls = [];
  let settings = { ...DEFAULT_SETTINGS, notificationsEnabled: true };
  const controller = createBackgroundAlertController({
    loadSettingsValue: async () => settings,
    alarms: {
      async create(name, config) { calls.push(['create', name, config]); },
      async clear(name) { calls.push(['clear', name]); }
    },
    notificationManager: { observe: async () => {}, dispose() {} }
  });

  assert.deepEqual(await controller.reconcile(), { enabled: true, supported: true });
  assert.deepEqual(calls[0], ['create', BACKGROUND_ALERT_ALARM, { periodInMinutes: BACKGROUND_ALERT_PERIOD_MINUTES }]);
  settings = { ...settings, notificationsEnabled: false };
  assert.deepEqual(await controller.reconcile(), { enabled: false, supported: true });
  assert.deepEqual(calls[1], ['clear', BACKGROUND_ALERT_ALARM]);
});

test('background controller fetches one validated snapshot and forwards it without connection alerts', async () => {
  const observed = [];
  const controller = createBackgroundAlertController({
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS, notificationsEnabled: true }),
    fetchSnapshot: async () => ({ currentPrice: 100000, lastTickerAt: 123 }),
    notificationManager: { observe: async (snapshot) => observed.push(snapshot), dispose() {} },
    alarms: null
  });

  const result = await controller.runOnce();
  assert.deepEqual(result, { status: 'ok', currentPrice: 100000 });
  assert.equal(observed.length, 1);
  assert.equal(observed[0].settings.notifyConnectionIssues, false);
  assert.equal(observed[0].state.connectionStatus, 'LIVE');
});

test('background controller contains fetch failures and does not notify from invalid data', async () => {
  const warnings = [];
  const observed = [];
  const controller = createBackgroundAlertController({
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS, notificationsEnabled: true }),
    fetchSnapshot: async () => { throw new Error('network'); },
    notificationManager: { observe: async (snapshot) => observed.push(snapshot), dispose() {} },
    alarms: null,
    onWarning: (...args) => warnings.push(args)
  });

  const result = await controller.runOnce();
  assert.equal(result.status, 'error');
  assert.equal(observed.length, 0);
  assert.equal(warnings.length, 1);
});


test('background controller coalesces overlapping checks into one fetch', async () => {
  let release;
  let fetches = 0;
  const controller = createBackgroundAlertController({
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS, notificationsEnabled: true }),
    fetchSnapshot: async () => {
      fetches += 1;
      await new Promise((resolve) => { release = resolve; });
      return { currentPrice: 100000 };
    },
    notificationManager: { observe: async () => {}, dispose() {} },
    alarms: null
  });

  const first = controller.runOnce();
  const second = controller.runOnce();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetches, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b);
  assert.equal(fetches, 1);
});
