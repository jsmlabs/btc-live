import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPercent, formatPrice, formatSpread, formatVolume } from '../src/utils/format.js';
import { formatRelativeTime, isPlausibleTimestamp } from '../src/utils/time.js';

test('formats BTC prices with stable two-decimal precision', () => {
  assert.equal(formatPrice(85742.3), '85,742.30');
  assert.equal(formatPrice(Number.NaN), '—');
});

test('formats percentages with explicit sign except zero', () => {
  assert.equal(formatPercent(1.42), '+1.42%');
  assert.equal(formatPercent(-0.83), '-0.83%');
  assert.equal(formatPercent(0), '0.00%');
});

test('formats quote volume compactly', () => {
  assert.equal(formatVolume(2_840_000_000), '2.84B');
  assert.equal(formatVolume(842_310_000), '842.31M');
  assert.equal(formatVolume(-1), '—');
});

test('formats spreads without hiding sub-cent values', () => {
  assert.equal(formatSpread(0.5), '0.500');
  assert.equal(formatSpread(0.0042), '0.0042');
});

test('formats relative timestamps deterministically', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(now, now), '<1s ago');
  assert.equal(formatRelativeTime(now - 18_000, now), '18s ago');
  assert.equal(formatRelativeTime(now - 120_000, now), '2m ago');
});

test('validates plausible timestamps', () => {
  const now = 1_700_000_000_000;
  assert.equal(isPlausibleTimestamp(now, now), true);
  assert.equal(isPlausibleTimestamp(now + 120_000, now), false);
  assert.equal(isPlausibleTimestamp(now - 72 * 60 * 60 * 1000, now), false);
});
