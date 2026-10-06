import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSerialDiagnosticsWriter,
  createSessionDiagnostics,
  loadSessionDiagnostics,
  recordConnected,
  recordDisconnect,
  recordReconnect,
  resetSessionDiagnostics,
  sanitizeSessionDiagnostics,
  saveSessionDiagnostics
} from '../storage/session-diagnostics.js';

test('session diagnostics sanitize persisted telemetry without accepting invalid values', () => {
  const now = 5_000;
  const value = sanitizeSessionDiagnostics({
    startedAt: 1_000,
    reconnectCount: -4,
    lastConnectedAt: 4_000,
    lastDisconnectAt: 'bad',
    lastDisconnectReason: '  network   reset  '
  }, now);

  assert.equal(value.startedAt, 1_000);
  assert.equal(value.reconnectCount, 0);
  assert.equal(value.lastConnectedAt, 4_000);
  assert.equal(value.lastDisconnectAt, null);
  assert.equal(value.lastDisconnectReason, 'network reset');
});

test('session diagnostics track connect, disconnect and reconnect events', () => {
  let value = createSessionDiagnostics(1_000);
  value = recordConnected(value, 2_000);
  value = recordDisconnect(value, 'Socket closed.', 3_000);
  value = recordReconnect(value, 'Retrying stream.', 4_000);

  assert.equal(value.lastConnectedAt, 2_000);
  assert.equal(value.reconnectCount, 1);
  assert.equal(value.lastDisconnectAt, 4_000);
  assert.equal(value.lastDisconnectReason, 'Retrying stream.');
});

test('session diagnostics round-trip through browser session storage and reset', async (t) => {
  const previousChrome = globalThis.chrome;
  t.after(() => {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  });

  const memory = {};
  globalThis.chrome = {
    storage: {
      session: {
        async get(key) { return { [key]: memory[key] }; },
        async set(value) { Object.assign(memory, value); }
      }
    }
  };

  const saved = recordReconnect(createSessionDiagnostics(1_000), 'Disconnected.', 2_000);
  await saveSessionDiagnostics(saved);
  const loaded = await loadSessionDiagnostics(3_000);
  assert.equal(loaded.reconnectCount, 1);
  assert.equal(loaded.lastDisconnectReason, 'Disconnected.');

  const reset = await resetSessionDiagnostics(4_000);
  assert.equal(reset.reconnectCount, 0);
  assert.equal((await loadSessionDiagnostics(5_000)).startedAt, 4_000);
});

test('serial diagnostics writer preserves order and continues after failure', async () => {
  const calls = [];
  let failFirst = true;
  const persist = createSerialDiagnosticsWriter(async (value) => {
    calls.push(value.reconnectCount);
    if (failFirst) {
      failFirst = false;
      throw new Error('write failed');
    }
    return value;
  });

  await assert.rejects(persist({ ...createSessionDiagnostics(1), reconnectCount: 1 }));
  await persist({ ...createSessionDiagnostics(1), reconnectCount: 2 });
  assert.deepEqual(calls, [1, 2]);
});
