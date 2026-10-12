import assert from 'node:assert/strict';
import test from 'node:test';
import { createBtcLiveRuntime } from '../app/runtime.js';
import { DEFAULT_SETTINGS } from '../storage/settings.js';

const NOW = 1_800_000_000_000;

function snapshotData() {
  return {
    symbol: 'BTCUSDT',
    currentPrice: 100_000,
    priceChange24h: 1_000,
    priceChangePercent24h: 1,
    open24h: 99_000,
    high24h: 101_000,
    low24h: 98_000,
    baseVolume24h: 10,
    quoteVolume24h: 1_000_000,
    bidPrice: 99_999,
    askPrice: 100_001,
    lastTickerTradeId: 10,
    lastTickerAt: NOW,
    lastTickerReceivedAt: NOW,
    lastValidUpdateAt: NOW,
    source: 'REST'
  };
}

test('shared runtime initializes once and exposes the same state contract to any view', async () => {
  let socketCallbacks;
  const renders = [];
  const runtime = createBtcLiveRuntime({
    onChange: (value) => renders.push(value),
    fetchSnapshot: async () => snapshotData(),
    createSocket(callbacks) {
      socketCallbacks = callbacks;
      return { close() {} };
    },
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS, compactLayout: true }),
    loadDiagnosticsValue: async () => ({
      version: 1,
      startedAt: NOW - 60_000,
      reconnectCount: 2,
      lastConnectedAt: null,
      lastDisconnectAt: null,
      lastDisconnectReason: null
    }),
    persistSettings: async (settings) => settings,
    persistDiagnostics: async (diagnostics) => diagnostics,
    resetDiagnosticsValue: async () => ({
      version: 1, startedAt: NOW, reconnectCount: 0,
      lastConnectedAt: null, lastDisconnectAt: null, lastDisconnectReason: null
    }),
    now: () => NOW,
    isOnline: () => true,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });

  await runtime.start();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(typeof socketCallbacks.onTrade, 'function');
  assert.equal(typeof socketCallbacks.onBookTicker, 'function');
  assert.equal(runtime.snapshot().settings.compactLayout, true);
  assert.equal(runtime.snapshot().state.currentPrice, 100_000);
  assert.ok(renders.length >= 2);

  socketCallbacks.onOpen();
  socketCallbacks.onTrade({
    currentPrice: 100_100,
    lastTradeId: 11,
    lastTradeAt: NOW + 1,
    lastTradeReceivedAt: NOW + 1,
    lastValidUpdateAt: NOW + 1,
    source: 'WEBSOCKET'
  });
  assert.equal(runtime.snapshot().state.currentPrice, 100_100);
  assert.equal(runtime.snapshot().state.priceSource, 'TRADE');

  socketCallbacks.onBookTicker({
    bidPrice: 100_099,
    askPrice: 100_101,
    lastBookAt: NOW + 2,
    lastBookReceivedAt: NOW + 2,
    lastValidUpdateAt: NOW + 2,
    bookSource: 'WEBSOCKET'
  });
  assert.equal(runtime.snapshot().state.bidPrice, 100_099);
  assert.equal(runtime.snapshot().state.askPrice, 100_101);
  assert.equal(runtime.snapshot().state.bookSource, 'WEBSOCKET');

  runtime.syncSettings({ compactLayout: false, showBidAsk: false });
  assert.deepEqual(runtime.snapshot().settings, { ...DEFAULT_SETTINGS, compactLayout: false, showBidAsk: false });

  runtime.dispose('test complete');
  assert.equal(runtime.snapshot().disposed, true);
});

test('shared runtime start is idempotent', async () => {
  let sockets = 0;
  const runtime = createBtcLiveRuntime({
    fetchSnapshot: async () => snapshotData(),
    createSocket() { sockets += 1; return { close() {} }; },
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS }),
    loadDiagnosticsValue: async () => ({
      version: 1, startedAt: NOW, reconnectCount: 0,
      lastConnectedAt: null, lastDisconnectAt: null, lastDisconnectReason: null
    }),
    persistSettings: async (settings) => settings,
    persistDiagnostics: async (diagnostics) => diagnostics,
    now: () => NOW,
    isOnline: () => true,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });

  await runtime.start();
  await runtime.start();
  assert.equal(sockets, 1);
  runtime.dispose();
});


test('runtime sanitizes optimistic and persisted settings values', async () => {
  const rendered = [];
  const runtime = createBtcLiveRuntime({
    onChange: (value) => rendered.push(value.settings),
    fetchSnapshot: async () => snapshotData(),
    createSocket() { return { close() {} }; },
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS }),
    loadDiagnosticsValue: async () => ({
      version: 1, startedAt: NOW, reconnectCount: 0,
      lastConnectedAt: null, lastDisconnectAt: null, lastDisconnectReason: null
    }),
    persistSettings: async () => ({ compactLayout: 'invalid', showBidAsk: false }),
    persistDiagnostics: async (diagnostics) => diagnostics,
    now: () => NOW,
    isOnline: () => true,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });

  await runtime.start();
  await runtime.updateSettings({ compactLayout: 'invalid', showBidAsk: false });
  assert.deepEqual(runtime.snapshot().settings, { ...DEFAULT_SETTINGS, compactLayout: false, showBidAsk: false });
  assert.equal(rendered.some((value) => typeof value.compactLayout !== 'boolean'), false);
  runtime.dispose();
});

test('concurrent runtime start calls share initialization and wait for completion', async () => {
  let resolveSettings;
  let sockets = 0;
  const settingsGate = new Promise((resolve) => { resolveSettings = resolve; });
  const runtime = createBtcLiveRuntime({
    fetchSnapshot: async () => snapshotData(),
    createSocket() { sockets += 1; return { close() {} }; },
    loadSettingsValue: async () => settingsGate,
    loadDiagnosticsValue: async () => ({
      version: 1, startedAt: NOW, reconnectCount: 0,
      lastConnectedAt: null, lastDisconnectAt: null, lastDisconnectReason: null
    }),
    persistSettings: async (settings) => settings,
    persistDiagnostics: async (diagnostics) => diagnostics,
    now: () => NOW,
    isOnline: () => true,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });

  const first = runtime.start();
  const second = runtime.start();
  assert.equal(first, second);
  assert.equal(sockets, 0);

  resolveSettings({ ...DEFAULT_SETTINGS, showVolume: false });
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.settings.showVolume, false);
  assert.equal(secondResult.settings.showVolume, false);
  assert.equal(sockets, 1);
  runtime.dispose();
});

test('runtime sanitizes settings loaded through an injected persistence adapter', async () => {
  const runtime = createBtcLiveRuntime({
    fetchSnapshot: async () => snapshotData(),
    createSocket() { return { close() {} }; },
    loadSettingsValue: async () => ({ compactLayout: 'invalid', showBidAsk: false }),
    loadDiagnosticsValue: async () => ({
      version: 1, startedAt: NOW, reconnectCount: 0,
      lastConnectedAt: null, lastDisconnectAt: null, lastDisconnectReason: null
    }),
    persistSettings: async (settings) => settings,
    persistDiagnostics: async (diagnostics) => diagnostics,
    now: () => NOW,
    isOnline: () => true,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });

  await runtime.start();
  assert.deepEqual(runtime.snapshot().settings, { ...DEFAULT_SETTINGS, compactLayout: false, showBidAsk: false });
  runtime.dispose();
});

function createSettingsRaceRuntime({ persistSettings, loadSettingsValue, onWarning = () => {} }) {
  return createBtcLiveRuntime({
    onWarning,
    fetchSnapshot: async () => snapshotData(),
    createSocket: () => ({ close() {} }),
    loadSettingsValue,
    loadDiagnosticsValue: async () => ({
      version: 1, startedAt: NOW, reconnectCount: 0,
      lastConnectedAt: null, lastDisconnectAt: null, lastDisconnectReason: null
    }),
    persistSettings,
    persistDiagnostics: async (value) => value,
    now: () => NOW,
    isOnline: () => true,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
}

test('stale persistence results cannot overwrite newer runtime settings', async () => {
  const pendingWrites = [];
  const runtime = createSettingsRaceRuntime({
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS }),
    persistSettings: (value) => new Promise((resolve) => {
      pendingWrites.push({ value, resolve });
    })
  });

  try {
    await runtime.start();
    const first = runtime.updateSettings({ ...DEFAULT_SETTINGS, showVolume: false });
    const second = runtime.updateSettings({ ...DEFAULT_SETTINGS, compactLayout: true });
    assert.equal(runtime.snapshot().settings.compactLayout, true);
    assert.equal(pendingWrites.length, 2);

    pendingWrites[0].resolve(pendingWrites[0].value);
    await first;
    assert.equal(runtime.snapshot().settings.compactLayout, true);

    pendingWrites[1].resolve(pendingWrites[1].value);
    await second;
    assert.equal(runtime.snapshot().settings.compactLayout, true);
  } finally {
    runtime.dispose();
  }
});

test('late settings recovery cannot overwrite a newer completed update', async () => {
  let loads = 0;
  let writes = 0;
  let signalRecoveryStarted;
  let releaseRecovery;
  const recoveryStarted = new Promise((resolve) => { signalRecoveryStarted = resolve; });
  const recoveryValue = new Promise((resolve) => { releaseRecovery = resolve; });
  const runtime = createSettingsRaceRuntime({
    loadSettingsValue: async () => {
      if (++loads === 1) return { ...DEFAULT_SETTINGS };
      signalRecoveryStarted();
      return recoveryValue;
    },
    persistSettings: async (value) => {
      if (++writes === 1) throw new Error('Injected storage failure');
      return value;
    }
  });

  try {
    await runtime.start();
    const first = runtime.updateSettings({ ...DEFAULT_SETTINGS, showVolume: false });
    await recoveryStarted;
    const second = runtime.updateSettings({ ...DEFAULT_SETTINGS, compactLayout: true });
    await second;
    releaseRecovery({ ...DEFAULT_SETTINGS, compactLayout: false });
    await first;

    assert.equal(runtime.snapshot().settings.compactLayout, true);
    assert.equal(loads, 2);
  } finally {
    runtime.dispose();
  }
});

test('runtime flags book-only failures as degraded without discarding current price', async () => {
  let callbacks;
  const runtime = createBtcLiveRuntime({
    fetchSnapshot: async () => snapshotData(),
    createSocket: (value) => { callbacks = value; return { close() {} }; },
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS }),
    loadDiagnosticsValue: async () => ({ version: 1, startedAt: NOW, reconnectCount: 0 }),
    persistDiagnostics: async (value) => value,
    now: () => NOW,
    setTimeoutFn: () => 1, clearTimeoutFn: () => {},
    setIntervalFn: () => 1, clearIntervalFn: () => {}
  });
  try {
    await runtime.start();
    await Promise.resolve(); await Promise.resolve();
    callbacks.onFeedStatus('market', 'LIVE');
    callbacks.onFeedStatus('book', 'LIVE');
    callbacks.onOpen();
    callbacks.onTrade({ currentPrice: 100100, lastTradeId: 25, lastTradeAt: NOW + 1, lastTradeReceivedAt: NOW + 1, lastValidUpdateAt: NOW + 1 });
    callbacks.onFeedStatus('book', 'RECONNECTING');
    assert.equal(runtime.snapshot().state.connectionStatus, 'DEGRADED');
    assert.equal(runtime.snapshot().state.currentPrice, 100100);
    assert.equal(runtime.snapshot().feedConnections.book, 'RECONNECTING');
    callbacks.onFeedStatus('book', 'LIVE');
    assert.equal(runtime.snapshot().feedConnections.book, 'LIVE');
  } finally { runtime.dispose(); }
});

test('book updates cannot falsely restore LIVE status while market feed reconnects', async () => {
  let callbacks;
  const runtime = createBtcLiveRuntime({
    fetchSnapshot: async () => snapshotData(),
    createSocket: (value) => { callbacks = value; return { close() {} }; },
    loadSettingsValue: async () => ({ ...DEFAULT_SETTINGS }),
    loadDiagnosticsValue: async () => ({ version: 1, startedAt: NOW, reconnectCount: 0 }),
    persistDiagnostics: async (value) => value,
    now: () => NOW,
    setTimeoutFn: () => 1, clearTimeoutFn: () => {},
    setIntervalFn: () => 1, clearIntervalFn: () => {}
  });
  try {
    await runtime.start(); await Promise.resolve(); await Promise.resolve();
    callbacks.onFeedStatus('market', 'LIVE');
    callbacks.onFeedStatus('book', 'LIVE');
    callbacks.onOpen();
    callbacks.onTrade({ currentPrice: 100100, lastTradeId: 25, lastTradeAt: NOW + 1, lastTradeReceivedAt: NOW + 1, lastValidUpdateAt: NOW + 1 });
    callbacks.onClose({ code: 1006 });
    callbacks.onFeedStatus('market', 'RECONNECTING');
    callbacks.onBookTicker({ bidPrice: 100099, askPrice: 100101, lastBookAt: NOW + 2, lastBookReceivedAt: NOW + 2, lastValidUpdateAt: NOW + 2 });
    assert.equal(runtime.snapshot().state.connectionStatus, 'RECONNECTING');
    assert.equal(runtime.snapshot().feedConnections.book, 'LIVE');
  } finally { runtime.dispose(); }
});
