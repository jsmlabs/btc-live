import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRelativeTime, isPlausibleTimestamp, isRecentTimestamp } from '../utils/time.js';

const NOW = 1_800_000_000_000;

test('formatRelativeTime handles seconds, minutes and hours', () => {
  assert.equal(formatRelativeTime(NOW, NOW), '<1s ago');
  assert.equal(formatRelativeTime(NOW - 15_000, NOW), '15s ago');
  assert.equal(formatRelativeTime(NOW - 120_000, NOW), '2m ago');
  assert.equal(formatRelativeTime(NOW - 7_200_000, NOW), '2h ago');
});

test('isPlausibleTimestamp enforces age and future-skew limits', () => {
  assert.equal(isPlausibleTimestamp(NOW, NOW), true);
  assert.equal(isPlausibleTimestamp(NOW + 60_000, NOW), true);
  assert.equal(isPlausibleTimestamp(NOW + 60_001, NOW), false);
  assert.equal(isPlausibleTimestamp(NOW - 49 * 60 * 60 * 1000, NOW), false);
});


test('isRecentTimestamp enforces a task-specific freshness window', () => {
  assert.equal(isRecentTimestamp(NOW - 30_000, NOW, 30_000), true);
  assert.equal(isRecentTimestamp(NOW - 30_001, NOW, 30_000), false);
  assert.throws(() => isRecentTimestamp(NOW, NOW, -1), TypeError);
});
