import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_ALERT_HISTORY, sanitizeAlertHistory, sanitizeAlertHistoryEntry } from '../storage/alert-history.js';

test('alert history sanitizer preserves supported diagnostic context', () => {
  const entry = sanitizeAlertHistoryEntry({
    id: 'e1', at: 100, type: 'target', status: 'suppressed', source: 'background',
    title: 'Target', message: 'Reached', currentPrice: 100000, targetId: 't1', targetPrice: 99999,
    direction: 'above', reason: 'cooldown_or_batch'
  });
  assert.equal(entry.status, 'suppressed');
  assert.equal(entry.targetId, 't1');
  assert.equal(entry.source, 'background');
  assert.equal(sanitizeAlertHistoryEntry({ at: -1, type: 'target' }), null);
});

test('alert history is bounded to the newest 100 sanitized entries', () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({ id: `e${index}`, at: index, type: 'price_move', status: 'sent' }));
  const history = sanitizeAlertHistory(rows);
  assert.equal(history.length, MAX_ALERT_HISTORY);
  assert.equal(history[0].id, 'e0');
  assert.equal(history.at(-1).id, 'e99');
});
