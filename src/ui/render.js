import { formatPercent, formatPrice, formatSpread, formatVolume } from '../utils/format.js';
import { formatRelativeTime } from '../utils/time.js';
import { statusView } from './status.js';

const nodes = {};
let flashTimer = null;
let lastAnimatedTradeAt = null;

function getNode(id) {
  return nodes[id] ??= document.getElementById(id);
}

export function renderMarket(state, settings, now = Date.now()) {
  const status = statusView(state.connectionStatus);
  const statusPill = getNode('statusPill');
  statusPill.dataset.tone = status.tone;
  getNode('statusText').textContent = status.label;

  const priceNode = getNode('currentPrice');
  priceNode.textContent = formatPrice(state.currentPrice);
  getNode('priceChange').textContent = formatPrice(state.priceChange24h);
  getNode('priceChangePercent').textContent = formatPercent(state.priceChangePercent24h);
  getNode('high24h').textContent = formatPrice(state.high24h);
  getNode('low24h').textContent = formatPrice(state.low24h);
  getNode('bidPrice').textContent = formatPrice(state.bidPrice);
  getNode('askPrice').textContent = formatPrice(state.askPrice);
  getNode('spread').textContent = formatSpread(state.spreadAbsolute);
  getNode('volume24h').textContent = state.quoteVolume24h === null ? '—' : `${formatVolume(state.quoteVolume24h)} USDT`;
  getNode('lastUpdate').textContent = state.lastValidUpdateAt ? `Updated ${formatRelativeTime(state.lastValidUpdateAt, now)}` : 'Waiting for data';

  const changeTone = Number.isFinite(state.priceChangePercent24h)
    ? state.priceChangePercent24h > 0 ? 'positive' : state.priceChangePercent24h < 0 ? 'negative' : 'neutral'
    : 'neutral';
  getNode('changeLine').dataset.tone = changeTone;

  getNode('bidAskSection').hidden = !settings.showBidAsk;
  getNode('volumeSection').hidden = !settings.showVolume;

  const message = getNode('stateMessage');
  message.textContent = state.errorMessage || statusMessage(state.connectionStatus);
  message.hidden = !message.textContent;

  if (
    settings.priceAnimation &&
    state.priceDirection !== 'FLAT' &&
    Number.isFinite(state.lastTradeAt) &&
    state.lastTradeAt !== lastAnimatedTradeAt
  ) {
    lastAnimatedTradeAt = state.lastTradeAt;
    flashPrice(priceNode, state.priceDirection);
  }
}

function flashPrice(node, direction) {
  clearTimeout(flashTimer);
  node.classList.remove('price-up', 'price-down');
  void node.offsetWidth;
  node.classList.add(direction === 'UP' ? 'price-up' : 'price-down');
  flashTimer = setTimeout(() => node.classList.remove('price-up', 'price-down'), 220);
}

function statusMessage(status) {
  switch (status) {
    case 'LOADING': return 'Loading market data...';
    case 'CONNECTING': return 'Connecting to Binance...';
    case 'STALE': return 'Market data may be delayed.';
    case 'RECONNECTING': return 'Reconnecting...';
    case 'OFFLINE': return 'Market data unavailable.';
    case 'ERROR': return 'Unable to load market data.';
    default: return '';
  }
}

export function renderSettings(settings) {
  getNode('settingBidAsk').checked = settings.showBidAsk;
  getNode('settingVolume').checked = settings.showVolume;
  getNode('settingAnimation').checked = settings.priceAnimation;
}
