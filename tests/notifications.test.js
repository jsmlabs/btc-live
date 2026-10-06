import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNotificationManager,
  evaluatePriceMove,
  evaluatePriceTargets,
  sanitizeNotificationState
} from '../app/notifications.js';
import { DEFAULT_SETTINGS } from '../storage/settings.js';

test('evaluatePriceMove initializes an anchor and detects threshold movement', () => {
  assert.deepEqual(evaluatePriceMove({ currentPrice: 100, anchorPrice: null, thresholdPercent: 0.5 }), { initializeAnchor: 100 });
  assert.equal(evaluatePriceMove({ currentPrice: 100.4, anchorPrice: 100, thresholdPercent: 0.5 }), null);
  const move = evaluatePriceMove({ currentPrice: 101, anchorPrice: 100, thresholdPercent: 0.5 });
  assert.equal(move.direction, 'up');
  assert.equal(move.changePercent, 1);
});

test('sanitizeNotificationState rejects malformed persisted state', () => {
  assert.deepEqual(sanitizeNotificationState({ anchorPrice: -1, lastPriceNotificationAt: -1 }), {
    anchorPrice: null,
    lastPriceNotificationAt: 0,
    lastTargetNotificationAt: 0,
    lastConnectionNotificationAt: 0,
    lastConnectionStatus: null
  });
});

test('notification manager sends one threshold alert and advances the anchor', async () => {
  const calls = [];
  let saved = null;
  let at = 1_000_000;
  const manager = createNotificationManager({
    now: () => at,
    notify: async (payload) => { calls.push(payload); return true; },
    loadState: async () => ({ anchorPrice: 100, lastPriceNotificationAt: 0 }),
    saveState: async (value) => { saved = { ...value }; return value; }
  });
  const settings = { ...DEFAULT_SETTINGS, notificationsEnabled: true, priceMovePercentThreshold: 0.5, notificationCooldownSeconds: 15 };

  await manager.observe({ settings, state: { currentPrice: 100.2, connectionStatus: 'LIVE' } });
  assert.equal(calls.length, 0);
  at += 20_000;
  await manager.observe({ settings, state: { currentPrice: 101, connectionStatus: 'LIVE' } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].title, /moved up/i);
  assert.equal(saved.anchorPrice, 101);
});

test('notification manager alerts on connection issue and later recovery', async () => {
  const calls = [];
  let state = { anchorPrice: 100, lastConnectionStatus: 'LIVE', lastConnectionNotificationAt: 0 };
  let at = 1_000_000;
  const manager = createNotificationManager({
    now: () => at,
    notify: async (payload) => { calls.push(payload); return true; },
    loadState: async () => state,
    saveState: async (value) => { state = { ...value }; return value; }
  });
  const settings = { ...DEFAULT_SETTINGS, notificationsEnabled: true, notifyPriceMove: false, notifyConnectionIssues: true, notificationCooldownSeconds: 15 };

  await manager.observe({ settings, state: { currentPrice: 100, connectionStatus: 'STALE', errorMessage: 'Price feed is stale.' } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].title, /stale/i);
  at += 20_000;
  await manager.observe({ settings, state: { currentPrice: 100, connectionStatus: 'LIVE' } });
  assert.equal(calls.length, 2);
  assert.match(calls[1].title, /restored/i);
});

test('notification manager remains silent when notifications are disabled', async () => {
  const calls = [];
  const manager = createNotificationManager({
    notify: async (payload) => { calls.push(payload); return true; },
    loadState: async () => ({ anchorPrice: 100 }),
    saveState: async (value) => value
  });
  await manager.observe({ settings: DEFAULT_SETTINGS, state: { currentPrice: 110, connectionStatus: 'STALE' } });
  assert.equal(calls.length, 0);
});


test('notification managers refresh shared state so sequential contexts do not duplicate a price alert', async () => {
  const calls = [];
  let persisted = { anchorPrice: 100, lastPriceNotificationAt: 0, lastConnectionStatus: 'LIVE' };
  const makeManager = () => createNotificationManager({
    now: () => 1_000_000,
    minProcessIntervalMs: 0,
    notify: async (payload) => { calls.push(payload); return true; },
    loadState: async () => ({ ...persisted }),
    saveState: async (value) => { persisted = { ...value }; return value; },
    withLock: async (task) => task()
  });
  const settings = { ...DEFAULT_SETTINGS, notificationsEnabled: true, notificationCooldownSeconds: 15 };
  const snapshot = { settings, state: { currentPrice: 101, connectionStatus: 'LIVE' } };

  const first = makeManager();
  const second = makeManager();
  await first.observe(snapshot);
  await second.observe(snapshot);
  assert.equal(calls.length, 1);
  assert.equal(persisted.anchorPrice, 101);
});


test('price target evaluation re-arms independently and prioritizes the furthest crossed level', () => {
  const targets = [
    { id: 'a', direction: 'above', price: 101, enabled: true, triggered: false, triggeredAt: null, createdAt: 1, updatedAt: 1, label: '' },
    { id: 'b', direction: 'above', price: 102, enabled: true, triggered: false, triggeredAt: null, createdAt: 1, updatedAt: 1, label: '' },
    { id: 'c', direction: 'below', price: 99, enabled: true, triggered: true, triggeredAt: 10, createdAt: 1, updatedAt: 1, label: '' }
  ];
  const result = evaluatePriceTargets(targets, 103, 20);
  assert.deepEqual(result.reached.map((target) => target.id), ['b', 'a']);
  assert.equal(result.targets.find((target) => target.id === 'c').triggered, false);
  assert.equal(result.changed, true);
});

test('multi-target manager fires once, marks all crossed targets triggered and re-arms individually', async () => {
  const calls = [];
  const history = [];
  let state = { anchorPrice: 100, lastTargetNotificationAt: 0, lastPriceNotificationAt: 0 };
  let targets = [
    { id: 'a', direction: 'above', price: 101, label: 'First', enabled: true, triggered: false, triggeredAt: null, createdAt: 1, updatedAt: 1 },
    { id: 'b', direction: 'above', price: 102, label: 'Second', enabled: true, triggered: false, triggeredAt: null, createdAt: 1, updatedAt: 1 }
  ];
  let at = 1_000_000;
  const manager = createNotificationManager({
    now: () => at,
    minProcessIntervalMs: 0,
    notify: async (payload) => { calls.push(payload); return true; },
    loadState: async () => ({ ...state }),
    saveState: async (value) => { state = { ...value }; return value; },
    loadTargets: async () => targets.map((target) => ({ ...target })),
    saveTargets: async (value) => { targets = value.map((target) => ({ ...target })); return value; },
    appendHistory: async (entry) => { history.push(entry); return entry; }
  });
  const settings = { ...DEFAULT_SETTINGS, notificationsEnabled: true, notifyPriceMove: false, notificationCooldownSeconds: 15 };

  await manager.observe({ settings, state: { currentPrice: 103, connectionStatus: 'LIVE' } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'btc-live-target-b');
  assert.equal(targets.every((target) => target.triggered), true);
  assert.equal(history.filter((entry) => entry.status === 'sent').length, 1);
  assert.equal(history.filter((entry) => entry.status === 'suppressed').length, 1);

  at += 20_000;
  await manager.observe({ settings, state: { currentPrice: 101.5, connectionStatus: 'LIVE' } });
  assert.equal(targets.find((target) => target.id === 'b').triggered, false);
  assert.equal(targets.find((target) => target.id === 'a').triggered, true);

  at += 20_000;
  await manager.observe({ settings, state: { currentPrice: 102.5, connectionStatus: 'LIVE' } });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].id, 'btc-live-target-b');
});

test('explicit target alert takes priority over percent move alert in the same snapshot', async () => {
  const calls = [];
  let persisted = { anchorPrice: 100, lastPriceNotificationAt: 0, lastTargetNotificationAt: 0 };
  let targets = [{ id: 'target-1', direction: 'above', price: 101, label: '', enabled: true, triggered: false, triggeredAt: null, createdAt: 1, updatedAt: 1 }];
  const manager = createNotificationManager({
    now: () => 1_000_000,
    minProcessIntervalMs: 0,
    notify: async (payload) => { calls.push(payload); return true; },
    loadState: async () => ({ ...persisted }),
    saveState: async (value) => { persisted = { ...value }; return value; },
    loadTargets: async () => targets,
    saveTargets: async (value) => { targets = value; return value; },
    appendHistory: async (entry) => entry
  });
  const settings = {
    ...DEFAULT_SETTINGS,
    notificationsEnabled: true,
    priceMovePercentThreshold: 0.5,
    notificationCooldownSeconds: 15
  };

  await manager.observe({ settings, state: { currentPrice: 101, connectionStatus: 'LIVE' } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'btc-live-target-target-1');
  assert.equal(persisted.anchorPrice, 101);
});

test('notification manager contains price-move notification failures and records them', async () => {
  const history = [];
  const warnings = [];
  let persisted = { anchorPrice: 100, lastPriceNotificationAt: 0, lastConnectionStatus: 'LIVE' };
  const manager = createNotificationManager({
    now: () => 1_000_000,
    minProcessIntervalMs: 0,
    notify: async () => { throw new Error('notification unavailable'); },
    loadState: async () => ({ ...persisted }),
    saveState: async (value) => { persisted = { ...value }; return value; },
    appendHistory: async (entry) => { history.push(entry); return entry; },
    onWarning: (...args) => warnings.push(args)
  });
  const settings = { ...DEFAULT_SETTINGS, notificationsEnabled: true, notifyConnectionIssues: false, notificationCooldownSeconds: 15 };

  await manager.observe({ settings, state: { currentPrice: 101, connectionStatus: 'LIVE' } });

  assert.equal(persisted.anchorPrice, 100);
  assert.equal(history.length, 1);
  assert.equal(history[0].type, 'price_move');
  assert.equal(history[0].status, 'failed');
  assert.equal(history[0].reason, 'notification_error');
  assert.equal(warnings.length, 1);
});

test('notification manager contains connection notification failures while advancing observed status', async () => {
  const history = [];
  const warnings = [];
  let persisted = { anchorPrice: 100, lastConnectionStatus: 'LIVE', lastConnectionNotificationAt: 0 };
  const manager = createNotificationManager({
    now: () => 1_000_000,
    minProcessIntervalMs: 0,
    notify: async () => { throw new Error('notification unavailable'); },
    loadState: async () => ({ ...persisted }),
    saveState: async (value) => { persisted = { ...value }; return value; },
    appendHistory: async (entry) => { history.push(entry); return entry; },
    onWarning: (...args) => warnings.push(args)
  });
  const settings = { ...DEFAULT_SETTINGS, notificationsEnabled: true, notifyPriceMove: false, notifyConnectionIssues: true, notificationCooldownSeconds: 15 };

  await manager.observe({ settings, state: { currentPrice: 100, connectionStatus: 'STALE', errorMessage: 'Price feed is stale.' } });

  assert.equal(persisted.lastConnectionStatus, 'STALE');
  assert.equal(persisted.lastConnectionNotificationAt, 0);
  assert.equal(history.length, 1);
  assert.equal(history[0].type, 'connection');
  assert.equal(history[0].status, 'failed');
  assert.equal(history[0].reason, 'notification_error');
  assert.equal(warnings.length, 1);
});
