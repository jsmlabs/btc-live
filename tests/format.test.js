import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPercent, formatPrice, formatSpread, formatUnsignedPercent, formatVolume } from '../utils/format.js';

test('formatters provide stable user-facing output', () => {
  assert.equal(formatPrice(100000), '100,000.00');
  assert.equal(formatPercent(1.25), '+1.25%');
  assert.equal(formatUnsignedPercent(0.01234), '0.0123%');
  assert.equal(formatSpread(0.125), '0.125');
  assert.equal(formatVolume(1_250_000), '1.25M');
});

test('formatters reject invalid values', () => {
  assert.equal(formatPrice(Number.NaN), '—');
  assert.equal(formatVolume(-1), '—');
  assert.equal(formatUnsignedPercent(-0.1), '—');
});
