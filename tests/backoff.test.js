import assert from 'node:assert/strict';
import test from 'node:test';
import { RECONNECT_DELAYS_MS, reconnectDelay } from '../utils/backoff.js';

test('reconnectDelay is deterministic and capped', () => {
  assert.equal(reconnectDelay(0), 1000);
  assert.equal(reconnectDelay(2), 4000);
  assert.equal(reconnectDelay(999), RECONNECT_DELAYS_MS.at(-1));
});

test('reconnectDelay rejects invalid attempts', () => {
  assert.throws(() => reconnectDelay(-1), TypeError);
  assert.throws(() => reconnectDelay(1.5), TypeError);
});
