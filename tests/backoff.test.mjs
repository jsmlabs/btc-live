import test from 'node:test';
import assert from 'node:assert/strict';
import { reconnectDelay } from '../src/utils/backoff.js';

test('reconnect backoff follows the specified capped sequence', () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, index) => reconnectDelay(index)), [
    1000, 2000, 4000, 8000, 15000, 30000, 30000, 30000, 30000
  ]);
});

test('reconnect backoff rejects invalid attempts', () => {
  assert.throws(() => reconnectDelay(-1), /non-negative integer/);
  assert.throws(() => reconnectDelay(1.5), /non-negative integer/);
});
