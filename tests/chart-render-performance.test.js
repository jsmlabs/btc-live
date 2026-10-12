import assert from 'node:assert/strict';
import test from 'node:test';
import { renderBtcChart } from '../ui/chart.js';

function mockDom() {
  const nodes = new Map();
  const counts = { rebuilds: 0, nodes: 0 };
  function makeNode() {
    return { dataset: {}, textContent: '', hidden: false, checked: false,
      attributes: new Map(), setAttribute(key, value) { this.attributes.set(key, value); },
      append() {}, replaceChildren() { counts.rebuilds++; } };
  }
  return {
    counts,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); },
    createElementNS() { counts.nodes++; return makeNode(); }
  };
}

const NOW = 1_800_000_000_000;
const base = {
  preferences: { interval: '5m', mode: 'candles', showVolume: true },
  candles: [
    { openTime: NOW - 600_000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
    { openTime: NOW - 300_000, open: 102, high: 110, low: 99, close: 108, volume: 20 }
  ],
  status: 'READY', errorMessage: null, lastLoadedAt: NOW
};
const market = { currentPrice: 108, high24h: 111, low24h: 90, open24h: 101 };

test('repeated identical snapshots avoid SVG rebuilding but still update sync age and labels', (t) => {
  const old = globalThis.document;
  t.after(() => { if (old === undefined) delete globalThis.document; else globalThis.document = old; });
  const dom = mockDom();
  globalThis.document = dom;
  renderBtcChart(base, market, NOW);
  assert.equal(dom.counts.rebuilds, 1);
  const nodeCount = dom.counts.nodes;
  renderBtcChart({ ...base, candles: base.candles.map(c => ({ ...c })) }, { ...market }, NOW + 120_000);
  assert.equal(dom.counts.rebuilds, 1);
  assert.equal(dom.counts.nodes, nodeCount);
  assert.equal(dom.getElementById('dashboardChartStatus').textContent, 'Live · synced 2m ago');
});

test('chart rebuilds on price, candle, reference, interval, mode and volume changes', (t) => {
  const old = globalThis.document;
  t.after(() => { if (old === undefined) delete globalThis.document; else globalThis.document = old; });
  const dom = mockDom();
  globalThis.document = dom;
  const cases = [
    [base, market],
    [base, { ...market, currentPrice: 109 }],
    [base, { ...market, currentPrice: 109, high24h: 114 }],
    [{ ...base, candles: base.candles.map((c, i) => i ? { ...c, close: 109 } : c) }, market],
    [{ ...base, preferences: { ...base.preferences, interval: '15m' } }, market],
    [{ ...base, preferences: { ...base.preferences, mode: 'line' } }, market],
    [{ ...base, preferences: { ...base.preferences, showVolume: false } }, market]
  ];
  cases.forEach(([chart, state]) => renderBtcChart(chart, state, NOW));
  assert.equal(dom.counts.rebuilds, cases.length);
  assert.match(dom.getElementById('dashboardChartSvg').attributes.get('aria-label'), /5m candles chart/);
});

test('empty/error chart transitions redraw the placeholder, including malformed candles', (t) => {
  const old = globalThis.document;
  t.after(() => { if (old === undefined) delete globalThis.document; else globalThis.document = old; });
  const dom = mockDom();
  globalThis.document = dom;
  renderBtcChart({ ...base, candles: [null], status: 'LOADING' }, null, NOW);
  renderBtcChart({ ...base, candles: [null], status: 'ERROR' }, null, NOW);
  assert.equal(dom.counts.rebuilds, 2);
  assert.equal(dom.getElementById('dashboardChartSvg').attributes.get('aria-label'), 'Bitcoin chart unavailable');
});
