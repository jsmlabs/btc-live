import test from 'node:test';
import assert from 'node:assert/strict';
import { bindNotificationTest } from '../ui/notification-test.js';

function controls() {
  const listeners = new Map(), attributes = new Map();
  return { button: { disabled: false,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name),
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name) },
  feedback: { textContent: '', dataset: {}, hidden: true }, listeners, attributes };
}

test('notification test blocks duplicate requests and distinguishes unavailable API', async () => {
  const ui = controls();
  let finish, calls = 0;
  const controller = bindNotificationTest({ ...ui, notify: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const pending = controller.run();
  await controller.run();
  assert.equal(calls, 1);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.attributes.get('aria-busy'), 'true');
  finish(false); await pending;
  assert.equal(ui.feedback.dataset.tone, 'warning');
  assert.match(ui.feedback.textContent, /unavailable/);
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.attributes.has('aria-busy'), false);
  controller.dispose();
});

test('notification API acceptance does not claim verified delivery', async () => {
  const ui = controls();
  const controller = bindNotificationTest({ ...ui, notify: async () => true });
  await controller.run();
  assert.equal(ui.feedback.dataset.tone, 'positive');
  assert.match(ui.feedback.textContent, /accepted the request/);
  assert.match(ui.feedback.textContent, /delivery is not guaranteed/);
  controller.dispose();
});

test('notification rejection is visible and controls recover', async t => {
  t.mock.method(console, 'warn', () => {});
  const ui = controls();
  const controller = bindNotificationTest({ ...ui, notify: async () => { throw Error('denied'); } });
  await controller.run();
  assert.equal(ui.feedback.dataset.tone, 'negative');
  assert.equal(ui.button.disabled, false);
  assert.match(ui.feedback.textContent, /failed/);
  controller.dispose();
});

test('disposed notification UI ignores a late result', async () => {
  const ui = controls();
  let finish;
  const controller = bindNotificationTest({ ...ui, notify: () => new Promise(resolve => { finish = resolve; }) });
  const pending = controller.run();
  controller.dispose();
  const pendingText = ui.feedback.textContent;
  finish(true); await pending;
  await controller.run();
  assert.equal(ui.feedback.textContent, pendingText);
  assert.equal(ui.listeners.size, 0);
});
