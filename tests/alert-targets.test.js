import assert from 'node:assert/strict';
import test from 'node:test';
import {
  legacyTargetsFromSettings,
  sanitizeAlertTarget,
  sanitizeAlertTargets
} from '../storage/alert-targets.js';
import { DEFAULT_SETTINGS } from '../storage/settings.js';

test('alert target sanitizer validates direction, price, label and state', () => {
  const target = sanitizeAlertTarget({
    id: 'x', direction: 'above', price: 100000.129, label: '  Breakout  ', enabled: true,
    triggered: true, triggeredAt: 10, createdAt: 1, updatedAt: 2
  }, { now: () => 5 });
  assert.equal(target.price, 100000.13);
  assert.equal(target.label, 'Breakout');
  assert.equal(target.triggered, true);
  assert.equal(sanitizeAlertTarget({ direction: 'sideways', price: 100000 }), null);
  assert.equal(sanitizeAlertTarget({ direction: 'below', price: 10 }), null);
});

test('alert target collection removes duplicate ids and enforces valid rows', () => {
  const targets = sanitizeAlertTargets([
    { id: 'a', direction: 'above', price: 1000 },
    { id: 'a', direction: 'below', price: 900 },
    { id: 'b', direction: 'below', price: 900 },
    { id: 'invalid', direction: 'bad', price: 900 }
  ]);
  assert.deepEqual(targets.map((target) => target.id), ['a', 'b']);
});

test('legacy single targets migrate into independent multi-target rows', () => {
  const targets = legacyTargetsFromSettings({
    ...DEFAULT_SETTINGS,
    notifyPriceAbove: true,
    priceAboveTarget: 110000,
    notifyPriceBelow: true,
    priceBelowTarget: 90000
  }, { now: () => 123 });
  assert.deepEqual(targets.map(({ id, direction, price }) => ({ id, direction, price })), [
    { id: 'legacy-above', direction: 'above', price: 110000 },
    { id: 'legacy-below', direction: 'below', price: 90000 }
  ]);
});
