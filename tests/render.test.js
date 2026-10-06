import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMarketState, CONNECTION_STATUS } from '../market/market-state.js';
import { renderDiagnostics, renderMarket } from '../ui/render.js';

const NOW = 1_800_000_000_000;

test('renderDiagnostics exposes connection, feed health and session telemetry deterministically', (t) => {
  const previousDocument = globalThis.document;
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const elements = new Map();
  globalThis.document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { textContent: '', title: '' });
      return elements.get(id);
    }
  };

  const state = {
    ...createInitialMarketState(),
    connectionStatus: CONNECTION_STATUS.RECONNECTING,
    priceSource: 'TRADE',
    tickerSource: 'WEBSOCKET',
    lastPriceEventAt: NOW - 1_000,
    lastTickerAt: NOW - 2_000
  };
  const diagnostics = {
    version: 1,
    startedAt: NOW - 2 * 60 * 60 * 1000,
    reconnectCount: 7,
    lastConnectedAt: NOW - 5_000,
    lastDisconnectAt: NOW - 10_000,
    lastDisconnectReason: 'Network interruption.'
  };

  renderDiagnostics(state, {
    now: NOW,
    online: true,
    reconnectAttempt: 3,
    nextRetryAt: NOW + 2_500,
    diagnostics
  });

  assert.equal(elements.get('diagConnection').textContent, 'RECONNECTING');
  assert.equal(elements.get('diagPriceFeed').textContent, 'FRESH · Trade · 1s ago');
  assert.equal(elements.get('diagStatsFeed').textContent, 'FRESH · Live · 2s ago');
  assert.equal(elements.get('diagReconnectCount').textContent, '7');
  assert.equal(elements.get('diagBackoff').textContent, 'Attempt 3 · 3s');
  assert.equal(elements.get('diagLastConnect').textContent, '5s ago');
  assert.equal(elements.get('diagLastDisconnect').textContent, '10s ago · Network interruption.');
  assert.equal(elements.get('diagSession').textContent, '2h 0m');
  assert.equal(elements.get('diagLastDisconnect').title, 'Network interruption.');
});


test('renderMarket applies compact density and exposes range position accessibly', (t) => {
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
      textContent: '',
      title: '',
      hidden: false,
      checked: false,
      dataset: {},
      offsetWidth: 1,
      style: {
        values: new Map(),
        setProperty(name, value) { this.values.set(name, value); }
      },
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
    rangePositionPercent: 65,
    priceSource: 'TRADE',
    tickerSource: 'WEBSOCKET',
    lastPriceEventAt: NOW - 500,
    lastTickerAt: NOW - 750
  };
  const settings = {
    compactLayout: true,
    showBidAsk: false,
    showVolume: true,
    showRange: true,
    priceAnimation: false
  };

  renderMarket(state, settings, NOW);

  assert.equal(elements.get('appShell').dataset.density, 'compact');
  assert.equal(elements.get('rangePosition').textContent, '65%');
  assert.equal(elements.get('rangeTrack').style.values.get('--range-position'), '65%');
  assert.equal(elements.get('rangeTrack').getAttribute('aria-valuenow'), '65');
  assert.equal(elements.get('rangeTrack').getAttribute('aria-valuetext'), '65% between the 24 hour low and high');
  assert.equal(elements.get('bidAskSection').hidden, true);
  assert.equal(elements.get('volumeSection').hidden, false);
  assert.equal(elements.get('rangeSection').hidden, false);
  assert.equal(elements.get('statusPill').getAttribute('aria-label'), 'Connection status: LIVE');

  renderMarket({
    ...state,
    connectionStatus: CONNECTION_STATUS.RECONNECTING,
    errorMessage: 'Live stream interrupted. Reconnecting...'
  }, settings, NOW, { nextRetryAt: NOW + 2_100 });
  assert.equal(elements.get('stateMessage').textContent, 'Live stream interrupted. Reconnecting. Retry in 3s.');

  renderMarket({ ...state, rangePositionPercent: null }, { ...settings, compactLayout: false }, NOW);
  assert.equal(elements.get('appShell').dataset.density, 'comfortable');
  assert.equal(elements.get('rangeTrack').getAttribute('aria-valuenow'), null);
  assert.equal(elements.get('rangeTrack').getAttribute('aria-valuetext'), 'Waiting for 24 hour range data');
});
