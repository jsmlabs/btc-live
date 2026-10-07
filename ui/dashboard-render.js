import { FEED_STATUS, deriveFeedHealth, priceEventAgeMs, tickerEventAgeMs } from '../market/market-state.js';
import { statusView } from './status.js';
import {
  formatPercent,
  formatPrice,
  formatSpread,
  formatUnsignedPercent,
  formatVolume
} from '../utils/format.js';

const nodes = {};
let flashTimer = null;
let lastAnimatedPriceKey = null;

function getNode(id) {
  return nodes[id] ??= document.getElementById(id);
}

export function renderDashboard(snapshot, now = Date.now()) {
  const { state, settings, nextRetryAt, online } = snapshot;
  const shell = getNode('dashboardShell');
  shell.dataset.density = settings.compactLayout ? 'compact' : 'comfortable';

  const status = statusView(online ? state.connectionStatus : 'OFFLINE');
  const statusPill = getNode('dashboardStatusPill');
  statusPill.dataset.tone = status.tone;
  statusPill.setAttribute('aria-label', `Connection status: ${status.label}`);
  getNode('dashboardStatusText').textContent = status.label;

  const priceNode = getNode('dashboardPrice');
  priceNode.textContent = formatPrice(state.currentPrice);
  getNode('dashboardChange').textContent = formatPrice(state.priceChange24h);
  getNode('dashboardChangePercent').textContent = formatPercent(state.priceChangePercent24h);
  getNode('dashboardOpen').textContent = formatPrice(state.open24h);
  getNode('dashboardHigh').textContent = formatPrice(state.high24h);
  getNode('dashboardLow').textContent = formatPrice(state.low24h);
  getNode('dashboardVolume').textContent = state.quoteVolume24h === null ? '—' : `${formatVolume(state.quoteVolume24h)} USDT`;
  getNode('dashboardBid').textContent = formatPrice(state.bidPrice);
  getNode('dashboardAsk').textContent = formatPrice(state.askPrice);
  getNode('dashboardSpread').textContent = formatSpread(state.spreadAbsolute);
  getNode('dashboardSpreadPercent').textContent = formatUnsignedPercent(state.spreadPercent);

  const changeTone = Number.isFinite(state.priceChangePercent24h)
    ? state.priceChangePercent24h > 0 ? 'positive' : state.priceChangePercent24h < 0 ? 'negative' : 'neutral'
    : 'neutral';
  getNode('dashboardChangeLine').dataset.tone = changeTone;

  const rangePosition = Number.isFinite(state.rangePositionPercent) ? state.rangePositionPercent : null;
  getNode('dashboardRangePosition').textContent = rangePosition === null ? '—' : `${Math.round(rangePosition)}%`;
  const rangeTrack = getNode('dashboardRangeTrack');
  rangeTrack.style.setProperty('--range-position', `${rangePosition ?? 0}%`);
  rangeTrack.dataset.empty = rangePosition === null ? 'true' : 'false';
  if (rangePosition === null) {
    rangeTrack.removeAttribute('aria-valuenow');
    rangeTrack.setAttribute('aria-valuetext', 'Waiting for 24 hour range data');
  } else {
    const rounded = Math.round(rangePosition);
    rangeTrack.setAttribute('aria-valuenow', String(rounded));
    rangeTrack.setAttribute('aria-valuetext', `${rounded}% between the 24 hour low and high`);
  }

  getNode('dashboardBidAskCard').hidden = !settings.showBidAsk;
  getNode('dashboardVolumeCard').hidden = !settings.showVolume;
  getNode('dashboardRangeCard').hidden = !settings.showRange;

  getNode('dashboardSource').textContent = sourceLabel(state);
  getNode('dashboardFreshness').textContent = freshnessLabel(state, now);
  const message = connectionMessage(state, now, nextRetryAt);
  const stateMessage = getNode('dashboardStateMessage');
  stateMessage.textContent = message;
  stateMessage.hidden = !message;
  getNode('dashboardRetryButton').hidden = !['STALE', 'RECONNECTING', 'OFFLINE', 'ERROR'].includes(state.connectionStatus);

  renderFeedHealth(state, now);
  renderSettings(settings);

  const animationKey = Number.isSafeInteger(state.lastPriceTradeId)
    ? `${state.lastPriceTradeId}:${state.priceSource ?? ''}`
    : Number.isFinite(state.lastPriceEventAt)
      ? `${state.lastPriceEventAt}:${state.priceSource ?? ''}`
      : null;
  if (settings.priceAnimation && state.priceDirection !== 'FLAT' && animationKey !== null && animationKey !== lastAnimatedPriceKey) {
    lastAnimatedPriceKey = animationKey;
    flashPrice(priceNode, state.priceDirection);
  }
}

function renderFeedHealth(state, now) {
  const health = deriveFeedHealth(state, now);
  getNode('dashboardPriceHealth').textContent = feedHealthLabel(health.price);
  getNode('dashboardStatsHealth').textContent = feedHealthLabel(health.stats);
  getNode('dashboardPriceSource').textContent = priceSourceLabel(state.priceSource);
  getNode('dashboardStatsSource').textContent = statsSourceLabel(state.tickerSource);
  getNode('dashboardPriceAge').textContent = health.priceAge === null ? 'Waiting' : formatAge(health.priceAge);
  getNode('dashboardStatsAge').textContent = health.tickerAge === null ? 'Waiting' : formatAge(health.tickerAge);
  getNode('dashboardPriceHealth').dataset.health = health.price.toLowerCase();
  getNode('dashboardStatsHealth').dataset.health = health.stats.toLowerCase();
}


function renderSettings(settings) {
  getNode('dashboardSettingCompact').checked = settings.compactLayout;
  getNode('dashboardSettingBidAsk').checked = settings.showBidAsk;
  getNode('dashboardSettingVolume').checked = settings.showVolume;
  getNode('dashboardSettingRange').checked = settings.showRange;
  getNode('dashboardSettingAnimation').checked = settings.priceAnimation;
  const notificationsEnabled = settings.notificationsEnabled;
  getNode('dashboardSettingNotifications').checked = notificationsEnabled;
  getNode('dashboardSettingBackgroundAlerts').checked = settings.backgroundAlertsEnabled;
  getNode('dashboardSettingBackgroundAlerts').disabled = !notificationsEnabled;
  getNode('dashboardSettingNotifyPrice').checked = settings.notifyPriceMove;
  getNode('dashboardSettingNotifyPrice').disabled = !notificationsEnabled;
  getNode('dashboardSettingNotifyConnection').checked = settings.notifyConnectionIssues;
  getNode('dashboardSettingNotifyConnection').disabled = !notificationsEnabled;
  getNode('dashboardSettingPriceThreshold').value = String(settings.priceMovePercentThreshold);
  getNode('dashboardSettingPriceThreshold').disabled = !notificationsEnabled || !settings.notifyPriceMove;
  getNode('dashboardSettingNotificationCooldown').value = String(settings.notificationCooldownSeconds);
  getNode('dashboardSettingNotificationCooldown').disabled = !notificationsEnabled;
}

function sourceLabel(state) {
  if (state.priceSource === 'REST') return 'FUTURES · REST';
  if (state.priceSource === 'TRADE') return 'FUTURES · TRADE';
  if (state.priceSource === 'TICKER') return 'FUTURES · TICKER';
  return 'BINANCE FUTURES';
}

function freshnessLabel(state, now) {
  const priceAge = priceEventAgeMs(state, now);
  const tickerAge = tickerEventAgeMs(state, now);
  if (priceAge === null && tickerAge === null) return 'Waiting for validated market data';
  const parts = [];
  if (priceAge !== null) parts.push(`Price ${formatAge(priceAge)}`);
  if (tickerAge !== null) parts.push(`Stats ${formatAge(tickerAge)}`);
  return parts.join(' · ');
}

function formatAge(age) {
  if (!Number.isFinite(age)) return 'Waiting';
  if (age < 1000) return '<1s ago';
  if (age < 60_000) return `${Math.floor(age / 1000)}s ago`;
  return `${Math.floor(age / 60_000)}m ago`;
}

function feedHealthLabel(status) {
  if (status === FEED_STATUS.FRESH) return 'FRESH';
  if (status === FEED_STATUS.STALE) return 'STALE';
  return 'WAITING';
}

function priceSourceLabel(source) {
  if (source === 'TRADE') return 'Trade stream';
  if (source === 'TICKER') return '24h ticker';
  if (source === 'REST') return 'REST fallback';
  return 'Waiting';
}

function statsSourceLabel(source) {
  if (source === 'WEBSOCKET') return '24h ticker';
  if (source === 'REST') return 'REST fallback';
  return 'Waiting';
}

function connectionMessage(state, now, nextRetryAt) {
  const base = state.errorMessage || statusMessage(state.connectionStatus);
  if (state.connectionStatus !== 'RECONNECTING' || !Number.isFinite(nextRetryAt) || nextRetryAt <= now) return base;
  const seconds = Math.max(1, Math.ceil((nextRetryAt - now) / 1000));
  return `${base.replace(/[.\s]+$/, '')}. Retry in ${seconds}s.`;
}

function statusMessage(status) {
  switch (status) {
    case 'LOADING': return 'Loading market data...';
    case 'CONNECTING': return 'Connecting to Binance...';
    case 'DEGRADED': return '24h market statistics may be delayed.';
    case 'STALE': return 'Current price data may be delayed.';
    case 'RECONNECTING': return 'Live stream interrupted. Reconnecting...';
    case 'OFFLINE': return 'Market data unavailable. Check your connection.';
    case 'ERROR': return 'Unable to load market data.';
    default: return '';
  }
}


function flashPrice(node, direction) {
  clearTimeout(flashTimer);
  node.classList.remove('price-up', 'price-down');
  void node.offsetWidth;
  node.classList.add(direction === 'UP' ? 'price-up' : 'price-down');
  flashTimer = setTimeout(() => node.classList.remove('price-up', 'price-down'), 220);
}
