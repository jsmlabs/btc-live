import test from 'node:test';
import assert from 'node:assert/strict';
import { UPDATE_ALARM, UPDATE_MESSAGE, UPDATE_KEY } from '../app/software-updates.js';

test('MV3 daily update alarm follows preference and manual checking stays available', async (t) => {
  const previous = globalThis.browser;
  const listeners = { installed: [], startup: [], alarm: [], message: [], storage: [] };
  const alarms = new Map();
  const events = [];
  let persisted = { [UPDATE_KEY]: { enabled: false, channel: 'stable' } };
  const event = key => ({ addListener(fn) { listeners[key].push(fn); } });
  globalThis.browser = {
    runtime: {
      getManifest: () => ({ version: '1.24.2' }),
      onInstalled: event('installed'), onStartup: event('startup'), onMessage: event('message')
    },
    storage: {
      local: {
        async get(key) { return { [key]: persisted[key] }; },
        async set(value) { persisted = { ...persisted, ...value }; }
      },
      onChanged: event('storage')
    },
    alarms: {
      onAlarm: event('alarm'),
      async create(name, info) { alarms.set(name, info); events.push('create:' + name); },
      async clear(name) { alarms.delete(name); events.push('clear:' + name); return true; }
    },
    notifications: { onClicked: event('alarm'), onClosed: event('alarm') }
  };
  t.after(() => { globalThis.browser = previous; });
  await import('../background/service-worker.js?update-alarm-test');
  const wait = () => new Promise(resolve => setImmediate(resolve));
  const message = action => new Promise(resolve => {
    const accepted = listeners.message.at(-1)({ type: UPDATE_MESSAGE, ...action }, {}, resolve);
    assert.equal(accepted, true);
  });

  // The disabled preference must not leave a scheduled daily alarm after startup.
  listeners.startup.forEach(fn => fn());
  await wait();
  assert.equal(alarms.has(UPDATE_ALARM), false);

  const enabled = await message({ action: 'configure', enabled: true });
  assert.equal(enabled.ok, true);
  assert.equal(alarms.get(UPDATE_ALARM).periodInMinutes, 1440);

  const disabled = await message({ action: 'configure', enabled: false });
  assert.equal(disabled.ok, true);
  assert.equal(alarms.has(UPDATE_ALARM), false);
  assert.ok(events.includes('clear:' + UPDATE_ALARM));

  // A manual request is still routed even when automatic scheduling is disabled.
  const read = await message({ action: 'read' });
  assert.equal(read.ok, true);
  assert.equal(read.state.enabled, false);
});
