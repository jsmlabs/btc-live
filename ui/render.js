import {
  formatPercent,
  formatPrice,
  formatSpread,
  formatUnsignedPercent,
  formatVolume
} from '../utils/format.js';
import {
  priceEventAgeMs,
  tickerEventAgeMs
} from '../market/market-state.js';
import { formatRelativeTime } from '../utils/time.js';
import { statusView } from './status.js';

const nodes = {};
let flashTimer = null;
let lastAnimatedPriceKey = null;

function getNode(id) {
  return nodes[id] ??= document.getElementById(id);
}

export function renderMarket(state, settings, now = Date.now(), { nextRetryAt = null } = {}) {
  getNode('appShell').dataset.density = settings.compactLayout ? 'compact' : 'comfortable';

  const status = statusView(state.connectionStatus);
  const statusPill = getNode('statusPill');
  statusPill.dataset.tone = status.tone;
  statusPill.setAttribute('aria-label', `Connection status: ${status.label}`);
  getNode('statusText').textContent = status.label;

  const priceNode = getNode('currentPrice');
  priceNode.textContent = formatPrice(state.currentPrice);
  getNode('priceChange').textContent = formatPrice(state.priceChange24h);
  getNode('priceChangePercent').textContent = formatPercent(state.priceChangePercent24h);
  getNode('open24h').textContent = formatPrice(state.open24h);
  getNode('high24h').textContent = formatPrice(state.high24h);
  getNode('low24h').textContent = formatPrice(state.low24h);
  getNode('bidPrice').textContent = formatPrice(state.bidPrice);
  getNode('askPrice').textContent = formatPrice(state.askPrice);
  getNode('spread').textContent = formatSpread(state.spreadAbsolute);
  getNode('spreadPercent').textContent = formatUnsignedPercent(state.spreadPercent);
  getNode('volume24h').textContent = state.quoteVolume24h === null ? '—' : `${formatVolume(state.quoteVolume24h)} USDT`;

  getNode('lastUpdate').textContent = freshnessLabel(state, now);
  getNode('dataSource').textContent = sourceLabel(state);
  statusPill.title = statusTooltip(state, now);

  const rangePosition = Number.isFinite(state.rangePositionPercent) ? state.rangePositionPercent : null;
  getNode('rangePosition').textContent = rangePosition === null ? '—' : `${Math.round(rangePosition)}%`;
  const rangeTrack = getNode('rangeTrack');
  rangeTrack.style.setProperty('--range-position', `${rangePosition ?? 0}%`);
  rangeTrack.dataset.empty = rangePosition === null ? 'true' : 'false';
  if (rangePosition === null) {
    rangeTrack.removeAttribute('aria-valuenow');
    rangeTrack.setAttribute('aria-valuetext', 'Waiting for 24 hour range data');
  } else {
    const roundedPosition = Math.round(rangePosition);
    rangeTrack.setAttribute('aria-valuenow', String(roundedPosition));
    rangeTrack.setAttribute('aria-valuetext', `${roundedPosition}% between the 24 hour low and high`);
  }

  const changeTone = Number.isFinite(state.priceChangePercent24h)
    ? state.priceChangePercent24h > 0 ? 'positive' : state.priceChangePercent24h < 0 ? 'negative' : 'neutral'
    : 'neutral';
  getNode('changeLine').dataset.tone = changeTone;

  getNode('bidAskSection').hidden = !settings.showBidAsk;
  getNode('volumeSection').hidden = !settings.showVolume;
  getNode('rangeSection').hidden = !settings.showRange;

  const message = getNode('stateMessage');
  message.textContent = connectionMessage(state, now, nextRetryAt);
  message.hidden = !message.textContent;

  const retryButton = getNode('retryButton');
  retryButton.hidden = !['STALE', 'RECONNECTING', 'OFFLINE', 'ERROR'].includes(state.connectionStatus);

  const animationKey = Number.isSafeInteger(state.lastPriceTradeId)
    ? `${state.lastPriceTradeId}:${state.priceSource ?? ''}`
    : Number.isFinite(state.lastPriceEventAt)
      ? `${state.lastPriceEventAt}:${state.priceSource ?? ''}`
      : null;
  if (
    settings.priceAnimation &&
    state.priceDirection !== 'FLAT' &&
    animationKey !== null &&
    animationKey !== lastAnimatedPriceKey
  ) {
    lastAnimatedPriceKey = animationKey;
    flashPrice(priceNode, state.priceDirection);
  }
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
  if (priceAge === null && tickerAge === null) return 'Waiting for data';

  const parts = [];
  if (priceAge !== null) parts.push(`Price ${formatRelativeTime(now - priceAge, now)}`);
  if (tickerAge !== null) parts.push(`Stats ${formatRelativeTime(now - tickerAge, now)}`);
  return parts.join(' · ');
}

function statusTooltip(state, now) {
  const priceAge = priceEventAgeMs(state, now);
  const tickerAge = tickerEventAgeMs(state, now);
  const details = [];
  if (priceAge !== null) details.push(`price ${formatRelativeTime(now - priceAge, now)}`);
  if (tickerAge !== null) details.push(`24h stats ${formatRelativeTime(now - tickerAge, now)}`);
  if (!details.length) return 'No validated market event received yet.';
  return `Validated Binance data: ${details.join(', ')}.`;
}

function flashPrice(node, direction) {
  clearTimeout(flashTimer);
  node.classList.remove('price-up', 'price-down');
  void node.offsetWidth;
  node.classList.add(direction === 'UP' ? 'price-up' : 'price-down');
  flashTimer = setTimeout(() => node.classList.remove('price-up', 'price-down'), 220);
}


function connectionMessage(state, now, nextRetryAt) {
  const base = state.errorMessage || statusMessage(state.connectionStatus);
  if (
    state.connectionStatus !== 'RECONNECTING' ||
    !Number.isFinite(nextRetryAt) ||
    nextRetryAt <= now
  ) return base;

  const seconds = Math.max(1, Math.ceil((nextRetryAt - now) / 1000));
  const normalized = base.replace(/[.\s]+$/, '');
  return `${normalized}. Retry in ${seconds}s.`;
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


export function renderSettings(settings) {
  getNode('settingCompact').checked = settings.compactLayout;
  getNode('settingBidAsk').checked = settings.showBidAsk;
  getNode('settingVolume').checked = settings.showVolume;
  getNode('settingRange').checked = settings.showRange;
  getNode('settingAnimation').checked = settings.priceAnimation;
  const notificationsEnabled = settings.notificationsEnabled;
  getNode('settingNotifications').checked = notificationsEnabled;
  getNode('settingBackgroundAlerts').checked = settings.backgroundAlertsEnabled;
  getNode('settingBackgroundAlerts').disabled = !notificationsEnabled;
  getNode('settingNotifyPrice').checked = settings.notifyPriceMove;
  getNode('settingNotifyPrice').disabled = !notificationsEnabled;
  getNode('settingNotifyConnection').checked = settings.notifyConnectionIssues;
  getNode('settingNotifyConnection').disabled = !notificationsEnabled;
  getNode('settingPriceThreshold').value = String(settings.priceMovePercentThreshold);
  getNode('settingPriceThreshold').disabled = !notificationsEnabled || !settings.notifyPriceMove;
  getNode('settingNotificationCooldown').value = String(settings.notificationCooldownSeconds);
  getNode('settingNotificationCooldown').disabled = !notificationsEnabled;
}
