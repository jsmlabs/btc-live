import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONNECTION_EVENT,
  CONNECTION_STATUS,
  applyConnectionEvent,
  transitionConnectionStatus
} from '../market/connection-state.js';

test('connection state machine follows the live lifecycle deterministically', () => {
  let status = CONNECTION_STATUS.INITIAL;
  status = transitionConnectionStatus(status, CONNECTION_EVENT.LOAD);
  assert.equal(status, CONNECTION_STATUS.LOADING);
  status = transitionConnectionStatus(status, CONNECTION_EVENT.CONNECT);
  assert.equal(status, CONNECTION_STATUS.CONNECTING);
  status = transitionConnectionStatus(status, CONNECTION_EVENT.DATA_FRESH);
  assert.equal(status, CONNECTION_STATUS.LIVE);
  status = transitionConnectionStatus(status, CONNECTION_EVENT.DATA_DEGRADED);
  assert.equal(status, CONNECTION_STATUS.DEGRADED);
  status = transitionConnectionStatus(status, CONNECTION_EVENT.DATA_STALE);
  assert.equal(status, CONNECTION_STATUS.STALE);
  status = transitionConnectionStatus(status, CONNECTION_EVENT.RECONNECT);
  assert.equal(status, CONNECTION_STATUS.RECONNECTING);
  status = transitionConnectionStatus(status, CONNECTION_EVENT.DATA_FRESH);
  assert.equal(status, CONNECTION_STATUS.LIVE);
});

test('connection state machine keeps invalid transitions from corrupting state', () => {
  assert.equal(
    transitionConnectionStatus(CONNECTION_STATUS.LIVE, CONNECTION_EVENT.CONNECT),
    CONNECTION_STATUS.LIVE
  );
  assert.equal(
    transitionConnectionStatus(CONNECTION_STATUS.INITIAL, CONNECTION_EVENT.DATA_FRESH),
    CONNECTION_STATUS.INITIAL
  );

  const state = { connectionStatus: CONNECTION_STATUS.LIVE, errorMessage: null, value: 1 };
  assert.strictEqual(applyConnectionEvent(state, CONNECTION_EVENT.CONNECT, 'must not leak'), state);
});

test('offline can recover through the reconnect path', () => {
  const offline = transitionConnectionStatus(CONNECTION_STATUS.LIVE, CONNECTION_EVENT.OFFLINE);
  assert.equal(offline, CONNECTION_STATUS.OFFLINE);
  assert.equal(
    transitionConnectionStatus(offline, CONNECTION_EVENT.RECONNECT),
    CONNECTION_STATUS.RECONNECTING
  );
});

test('applyConnectionEvent centralizes status and message updates', () => {
  const state = { connectionStatus: CONNECTION_STATUS.CONNECTING, errorMessage: null, value: 1 };
  const next = applyConnectionEvent(state, CONNECTION_EVENT.RECONNECT, 'Network interruption.');
  assert.deepEqual(next, {
    connectionStatus: CONNECTION_STATUS.RECONNECTING,
    errorMessage: 'Network interruption.',
    value: 1
  });
});

test('unknown connection statuses and events fail explicitly', () => {
  assert.throws(() => transitionConnectionStatus('UNKNOWN', CONNECTION_EVENT.CONNECT), TypeError);
  assert.throws(() => transitionConnectionStatus(CONNECTION_STATUS.LIVE, 'UNKNOWN'), TypeError);
});
