import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMarketState, CONNECTION_STATUS } from '../market/market-state.js';
import { renderDashboard } from '../ui/dashboard-render.js';

const NOW = 1_800_000_000_000;

test('dashboard renderer exposes market, feed health and settings', (t) => {
  const previousDocument = globalThis.document;
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const elements = new Map();
  function createElement() {
    const attributes = new Map();
    const classes = new Set();
    return {
      textContent: '', title: '', hidden: false, checked: false, dataset: {}, offsetWidth: 1,
      style: { values: new Map(), setProperty(name, value) { this.values.set(name, value); } },
      classList: {
        add(...names) { names.forEach((name) => classes.add(name)); },
        remove(...names) { names.forEach((name) => classes.delete(name)); }
      },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      removeAttribute(name) { attributes.delete(name); },
      getAttribute(name) { return attributes.get(name) ?? null; }
    };
  }
  globalThis.document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    }
  };

  const state = {
    ...createInitialMarketState(),
    connectionStatus: CONNECTION_STATUS.LIVE,
    currentPrice: 100_000,
    priceChange24h: 1_000,
    priceChangePercent24h: 1,
    open24h: 99_000,
    high24h: 101_000,
    low24h: 98_000,
    quoteVolume24h: 2_500_000,
    bidPrice: 99_999,
    askPrice: 100_001,
    spreadAbsolute: 2,
    spreadPercent: 0.002,
    rangePositionPercent: 66,
    priceSource: 'TRADE',
    tickerSource: 'WEBSOCKET',
    lastPriceEventAt: NOW - 500,
    lastTickerAt: NOW - 750
  };
  const settings = {
    compactLayout: true,
    showBidAsk: true,
    showVolume: false,
    showRange: true,
    priceAnimation: false
  };

  renderDashboard({ state, settings, reconnectAttempt: 0, nextRetryAt: null, online: true }, NOW);

  assert.equal(elements.get('dashboardShell').dataset.density, 'compact');
  assert.equal(elements.get('dashboardPrice').textContent, '100,000.00');
  assert.equal(elements.get('dashboardPriceHealth').textContent, 'FRESH');
  assert.equal(elements.get('dashboardStatsHealth').textContent, 'FRESH');
  assert.equal(elements.get('dashboardRangePosition').textContent, '66%');
  assert.equal(elements.get('dashboardRangeTrack').getAttribute('aria-valuenow'), '66');
  assert.equal(elements.get('dashboardVolumeCard').hidden, true);
  assert.equal(elements.get('dashboardBidAskCard').hidden, false);
  assert.equal(elements.get('dashboardSettingCompact').checked, true);
  assert.equal(elements.get('dashboardStatusPill').getAttribute('aria-label'), 'Connection status: LIVE');
});
