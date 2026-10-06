import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS, createSerialSettingsWriter, loadSettings, resetSettings, sanitizeSettings, saveSettings } from '../storage/settings.js';

test('sanitizeSettings preserves valid persisted settings and migrates missing keys', () => {
  assert.deepEqual(sanitizeSettings({ showBidAsk: false, showVolume: false, priceAnimation: false }), {
    compactLayout: false,
    showBidAsk: false,
    showVolume: false,
    showRange: true,
    priceAnimation: false,
    notificationsEnabled: false,
    backgroundAlertsEnabled: true,
    notifyPriceMove: true,
    priceMovePercentThreshold: 0.5,
    notifyPriceAbove: false,
    priceAboveTarget: null,
    notifyPriceBelow: false,
    priceBelowTarget: null,
    notifyConnectionIssues: true,
    notificationCooldownSeconds: 300
  });
});

test('sanitizeSettings accepts compact layout and rejects invalid values', () => {
  assert.equal(sanitizeSettings({ compactLayout: true }).compactLayout, true);
  assert.deepEqual(sanitizeSettings({ compactLayout: 'yes', showBidAsk: 'yes', showRange: 1 }), DEFAULT_SETTINGS);
});

test('settings storage round-trip uses one local storage key', async (t) => {
  const previousChrome = globalThis.chrome;
  t.after(() => {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  });

  const backing = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) { return { [key]: backing[key] }; },
        async set(value) { Object.assign(backing, value); }
      }
    }
  };

  const saved = await saveSettings({ ...DEFAULT_SETTINGS, showVolume: false });
  assert.equal(saved.showVolume, false);
  assert.equal((await loadSettings()).showVolume, false);
  assert.deepEqual(await resetSettings(), DEFAULT_SETTINGS);
  assert.deepEqual(await loadSettings(), DEFAULT_SETTINGS);
});

test('serial settings writer preserves mutation order across async writes', async () => {
  const calls = [];
  const releases = [];
  const write = (value) => new Promise((resolve) => {
    calls.push(value.showVolume);
    releases.push(() => resolve(value));
  });
  const persist = createSerialSettingsWriter(write);

  const first = persist({ ...DEFAULT_SETTINGS, showVolume: false });
  const second = persist({ ...DEFAULT_SETTINGS, showVolume: true });

  await Promise.resolve();
  assert.deepEqual(calls, [false]);
  releases.shift()();
  await first;
  await Promise.resolve();
  assert.deepEqual(calls, [false, true]);
  releases.shift()();
  await second;
});

test('serial settings writer continues after a failed write', async () => {
  let call = 0;
  const persist = createSerialSettingsWriter(async (value) => {
    call += 1;
    if (call === 1) throw new Error('write failed');
    return value;
  });

  await assert.rejects(persist({ ...DEFAULT_SETTINGS, showRange: false }), /write failed/);
  const saved = await persist({ ...DEFAULT_SETTINGS, showRange: true });
  assert.equal(saved.showRange, true);
});


test('notification settings sanitize supported ranges and reject invalid values', () => {
  const settings = sanitizeSettings({
    notificationsEnabled: true,
    backgroundAlertsEnabled: false,
    notifyPriceMove: false,
    priceMovePercentThreshold: 1.24,
    notifyPriceAbove: true,
    priceAboveTarget: 100000.129,
    notifyPriceBelow: true,
    priceBelowTarget: 90000,
    notifyConnectionIssues: false,
    notificationCooldownSeconds: 60
  });
  assert.equal(settings.notificationsEnabled, true);
  assert.equal(settings.backgroundAlertsEnabled, false);
  assert.equal(settings.notifyPriceMove, false);
  assert.equal(settings.priceMovePercentThreshold, 1.24);
  assert.equal(settings.notifyPriceAbove, true);
  assert.equal(settings.priceAboveTarget, 100000.13);
  assert.equal(settings.notifyPriceBelow, true);
  assert.equal(settings.priceBelowTarget, 90000);
  assert.equal(settings.notifyConnectionIssues, false);
  assert.equal(settings.notificationCooldownSeconds, 60);
  assert.equal(sanitizeSettings({ priceMovePercentThreshold: 0 }).priceMovePercentThreshold, 0.5);
  assert.equal(sanitizeSettings({ priceAboveTarget: 10 }).priceAboveTarget, null);
  assert.equal(sanitizeSettings({ priceBelowTarget: Number.NaN }).priceBelowTarget, null);
  assert.equal(sanitizeSettings({ notificationCooldownSeconds: 5 }).notificationCooldownSeconds, 300);
});
