export const CONNECTION_STATUS = Object.freeze({
  INITIAL: 'INITIAL',
  LOADING: 'LOADING',
  CONNECTING: 'CONNECTING',
  LIVE: 'LIVE',
  DEGRADED: 'DEGRADED',
  STALE: 'STALE',
  RECONNECTING: 'RECONNECTING',
  OFFLINE: 'OFFLINE',
  ERROR: 'ERROR'
});

export const CONNECTION_EVENT = Object.freeze({
  LOAD: 'LOAD',
  CONNECT: 'CONNECT',
  RECONNECT: 'RECONNECT',
  DATA_FRESH: 'DATA_FRESH',
  DATA_DEGRADED: 'DATA_DEGRADED',
  DATA_STALE: 'DATA_STALE',
  OFFLINE: 'OFFLINE',
  ERROR: 'ERROR'
});

const TARGET_STATUS = Object.freeze({
  [CONNECTION_EVENT.LOAD]: CONNECTION_STATUS.LOADING,
  [CONNECTION_EVENT.CONNECT]: CONNECTION_STATUS.CONNECTING,
  [CONNECTION_EVENT.RECONNECT]: CONNECTION_STATUS.RECONNECTING,
  [CONNECTION_EVENT.DATA_FRESH]: CONNECTION_STATUS.LIVE,
  [CONNECTION_EVENT.DATA_DEGRADED]: CONNECTION_STATUS.DEGRADED,
  [CONNECTION_EVENT.DATA_STALE]: CONNECTION_STATUS.STALE,
  [CONNECTION_EVENT.OFFLINE]: CONNECTION_STATUS.OFFLINE,
  [CONNECTION_EVENT.ERROR]: CONNECTION_STATUS.ERROR
});

const ALLOWED_EVENTS = Object.freeze({
  [CONNECTION_STATUS.INITIAL]: new Set(['LOAD', 'CONNECT', 'OFFLINE', 'ERROR']),
  [CONNECTION_STATUS.LOADING]: new Set(['CONNECT', 'RECONNECT', 'DATA_FRESH', 'DATA_DEGRADED', 'DATA_STALE', 'OFFLINE', 'ERROR']),
  [CONNECTION_STATUS.CONNECTING]: new Set(['CONNECT', 'RECONNECT', 'DATA_FRESH', 'DATA_DEGRADED', 'DATA_STALE', 'OFFLINE', 'ERROR']),
  [CONNECTION_STATUS.LIVE]: new Set(['RECONNECT', 'DATA_FRESH', 'DATA_DEGRADED', 'DATA_STALE', 'OFFLINE', 'ERROR']),
  [CONNECTION_STATUS.DEGRADED]: new Set(['RECONNECT', 'DATA_FRESH', 'DATA_DEGRADED', 'DATA_STALE', 'OFFLINE', 'ERROR']),
  [CONNECTION_STATUS.STALE]: new Set(['RECONNECT', 'DATA_FRESH', 'DATA_DEGRADED', 'DATA_STALE', 'OFFLINE', 'ERROR']),
  [CONNECTION_STATUS.RECONNECTING]: new Set(['RECONNECT', 'DATA_FRESH', 'DATA_DEGRADED', 'DATA_STALE', 'OFFLINE', 'ERROR']),
  [CONNECTION_STATUS.OFFLINE]: new Set(['CONNECT', 'RECONNECT', 'OFFLINE', 'ERROR']),
  [CONNECTION_STATUS.ERROR]: new Set(['LOAD', 'CONNECT', 'RECONNECT', 'OFFLINE', 'ERROR'])
});

export function transitionConnectionStatus(currentStatus, event) {
  validateTransitionInput(currentStatus, event);
  if (!ALLOWED_EVENTS[currentStatus].has(event)) return currentStatus;
  return TARGET_STATUS[event];
}

export function applyConnectionEvent(state, event, errorMessage = null) {
  validateTransitionInput(state.connectionStatus, event);
  if (!ALLOWED_EVENTS[state.connectionStatus].has(event)) return state;
  const connectionStatus = TARGET_STATUS[event];
  if (connectionStatus === state.connectionStatus && state.errorMessage === errorMessage) return state;
  return { ...state, connectionStatus, errorMessage };
}

function validateTransitionInput(currentStatus, event) {
  if (!(currentStatus in ALLOWED_EVENTS)) throw new TypeError(`Unknown connection status: ${currentStatus}`);
  if (!(event in TARGET_STATUS)) throw new TypeError(`Unknown connection event: ${event}`);
}
