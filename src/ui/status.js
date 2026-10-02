import { CONNECTION_STATUS } from '../market/market-state.js';

export const STATUS_VIEW = Object.freeze({
  [CONNECTION_STATUS.INITIAL]: { label: 'INITIAL', tone: 'neutral' },
  [CONNECTION_STATUS.LOADING]: { label: 'LOADING', tone: 'neutral' },
  [CONNECTION_STATUS.CONNECTING]: { label: 'CONNECTING', tone: 'warning' },
  [CONNECTION_STATUS.LIVE]: { label: 'LIVE', tone: 'live' },
  [CONNECTION_STATUS.STALE]: { label: 'STALE', tone: 'warning' },
  [CONNECTION_STATUS.RECONNECTING]: { label: 'RECONNECTING', tone: 'warning' },
  [CONNECTION_STATUS.OFFLINE]: { label: 'OFFLINE', tone: 'offline' },
  [CONNECTION_STATUS.ERROR]: { label: 'ERROR', tone: 'error' }
});

export function statusView(status) {
  return STATUS_VIEW[status] ?? STATUS_VIEW[CONNECTION_STATUS.ERROR];
}
