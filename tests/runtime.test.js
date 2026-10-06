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
