import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderScheduler } from '../ui/render-scheduler.js';

function fakeFrames() {
  const frames = new Map();
  let nextId = 0;
  const cancelled = [];
  return {
    frames, cancelled,
    requestFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelFrame(id) { cancelled.push(id); frames.delete(id); },
    tick() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); }
  };
}

test('scheduler merges rapid visual requests into one frame with the latest state', () => {
  const frames = fakeFrames();
  let state = 0;
  const painted = [];
  const scheduler = createRenderScheduler(() => painted.push(state), frames);
  for (let i = 1; i <= 100; i++) { state = i; scheduler.schedule(); }
  assert.equal(frames.frames.size, 1);
  frames.tick();
  assert.deepEqual(painted, [100]);
  state = 101;
  scheduler.schedule();
  frames.tick();
  assert.deepEqual(painted, [100, 101]);
});

test('flush renders pending data immediately and cancels the obsolete frame', () => {
  const frames = fakeFrames();
  let calls = 0;
  const scheduler = createRenderScheduler(() => calls++, frames);
  scheduler.schedule();
  scheduler.flush();
  assert.equal(calls, 1);
  assert.equal(frames.frames.size, 0);
  assert.deepEqual(frames.cancelled, [1]);
  frames.tick();
  scheduler.flush();
  assert.equal(calls, 1);
});

test('late cancelled frame cannot consume a new scheduled redraw', () => {
  const frames = fakeFrames();
  let calls = 0;
  const scheduler = createRenderScheduler(() => calls++, frames);
  scheduler.schedule();
  const cancelledCallback = [...frames.frames.values()][0];
  scheduler.flush();
  scheduler.schedule();
  cancelledCallback();
  assert.equal(calls, 1);
  assert.equal(frames.frames.size, 1);
  frames.tick();
  assert.equal(calls, 2);
  assert.equal(scheduler.diagnostics().frames, 2);
  scheduler.dispose();
});

test('dispose prevents pending, late and subsequent visual work', () => {
  const frames = fakeFrames();
  let calls = 0;
  const scheduler = createRenderScheduler(() => calls++, frames);
  scheduler.schedule();
  const stale = [...frames.frames.values()][0];
  scheduler.dispose();
  scheduler.schedule();
  scheduler.flush();
  stale();
  frames.tick();
  scheduler.dispose();
  assert.equal(calls, 0);
  assert.equal(frames.frames.size, 0);
});

test('updates arriving during render are scheduled for a new frame', () => {
  const frames = fakeFrames();
  let calls = 0;
  let scheduler;
  scheduler = createRenderScheduler(() => {
    calls++;
    if (calls === 1) scheduler.schedule();
  }, frames);
  scheduler.schedule();
  frames.tick();
  assert.equal(calls, 1);
  assert.equal(frames.frames.size, 1);
  frames.tick();
  assert.equal(calls, 2);
});

test('scheduler fails before side effects with invalid adapters', () => {
  assert.throws(() => createRenderScheduler(null), /must be functions/);
  assert.throws(() => createRenderScheduler(() => {}, { requestFrame: null }), /must be functions/);
});

test('redraw requested before a render exception is not stranded', () => {
  const frames = fakeFrames();
  let attempts = 0;
  let scheduler;
  scheduler = createRenderScheduler(() => {
    attempts++;
    if (attempts === 1) {
      scheduler.schedule();
      throw Error('temporary render failure');
    }
  }, frames);
  scheduler.schedule();
  assert.throws(() => frames.tick(), /temporary render failure/);
  assert.equal(frames.frames.size, 1);
  frames.tick();
  assert.equal(attempts, 2);
  assert.equal(scheduler.diagnostics().errors, 1);
  scheduler.dispose();
});
