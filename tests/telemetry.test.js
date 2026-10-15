import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeTelemetry, TELEMETRY_EVENT as E } from '../market/runtime-telemetry.js';
import { createBtcLiveRuntime } from '../app/runtime.js';

test('telemetry counts all events, bounds history and isolates snapshots', () => {
  let time = 42;
  const t = createRuntimeTelemetry({ now: () => time++, capacity: 2 });
  t.record(E.SOCKET_CONNECT, { feed: 'market', secret: 'DO_NOT_STORE' });
  t.record(E.SOCKET_OPEN);
  t.record(E.SOCKET_CLOSE);
  const s = t.snapshot();
  assert.equal(s.total, 3);
  assert.equal(s.counts.SOCKET_CONNECT, 1);
  assert.deepEqual(s.recent.map(x => x.type), [E.SOCKET_OPEN, E.SOCKET_CLOSE]);
  assert.equal(JSON.stringify(s).includes('DO_NOT_STORE'), false);
  s.counts.SOCKET_CONNECT = 999;
  s.recent[0].type = 'MUTATED';
  assert.equal(t.snapshot().counts.SOCKET_CONNECT, 1);
  assert.equal(t.snapshot().recent[0].type, E.SOCKET_OPEN);
});
test('telemetry rejects unknown events and invalid capacity', () => {
  assert.throws(() => createRuntimeTelemetry({ capacity: 0 }), RangeError);
  const t = createRuntimeTelemetry();
  assert.throws(() => t.record('CUSTOM', { secret: 'abc' }), RangeError);
});
test('runtime reports snapshot recovery and socket lifecycle without payload retention', async () => {
  let socketHandlers;
  const runtime = createBtcLiveRuntime({
    loadSettingsValue: async () => ({}),
    loadDiagnosticsValue: async () => ({}),
    fetchSnapshot: async () => { throw Error('PRIVATE_API_TOKEN'); },
    createSocket: (handlers) => { socketHandlers = handlers; return { close() {} }; },
    setTimeoutFn: () => 1, clearTimeoutFn: () => {},
    setIntervalFn: () => 2, clearIntervalFn: () => {},
    persistDiagnostics: async () => {},
    onWarning: () => {}, now: () => 1000
  });
  await runtime.start();
  await new Promise(resolve => setImmediate(resolve));
  socketHandlers.onOpen();
  socketHandlers.onError(new Error('SECRET_EVENT'), 'market');
  const telemetry = runtime.snapshot().telemetry;
  assert.equal(telemetry.counts.SOCKET_CONNECT, 1);
  assert.equal(telemetry.counts.SOCKET_OPEN, 1);
  assert.equal(telemetry.counts.SOCKET_ERROR, 1);
  assert.equal(telemetry.counts.SNAPSHOT_FAILURE, 1);
  assert.equal(JSON.stringify(telemetry).includes('SECRET'), false);
  runtime.dispose();
});
