import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCombinedMessage } from '../market/binance-websocket.js';

const NOW = 1_800_000_000_000;

test('parseCombinedMessage parses trade envelopes', () => {
  const raw = JSON.stringify({ data: { e: 'trade', s: 'BTCUSDT', p: '99999', t: 123456, T: NOW - 10 } });
  const parsed = parseCombinedMessage(raw, NOW);
  assert.equal(parsed.type, 'trade');
  assert.equal(parsed.value.currentPrice, 99999);
});

test('parseCombinedMessage ignores malformed or unsupported events', () => {
  assert.equal(parseCombinedMessage('{', NOW), null);
  assert.equal(parseCombinedMessage(JSON.stringify({ data: { e: 'depthUpdate' } }), NOW), null);
});
