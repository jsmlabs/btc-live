import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLiquidityBands, deriveLiquidityRows, createLiquidityRenderer } from '../ui/liquidity.js';

const book = {
  bids: new Map([[59328, 1], [59260, 2], [58750, 1], [54000, 100]]),
  asks: new Map([[59329, 3], [59499, 1], [60000, 2], [65000, 100]])
};
const pivot = 59328.5;

test('one shared bin contains both sides; descending axis includes unobserved gaps', () => {
  const view = deriveLiquidityRows(book, pivot, 250, 3);
  assert.deepEqual(view.rows.map(row => row.lower), [60000, 59750, 59500, 59250, 59000, 58750, 58500]);
  const center = view.rows.filter(row => row.containsPivot);
  assert.equal(center.length, 1);
  assert.equal(center[0].bid.notional, 59328 + 59260 * 2);
  assert.equal(center[0].ask.notional, 59329 * 3 + 59499);
  assert.equal(center[0].upper, 59500);
  assert.equal(view.rows[1].bid, null);
  assert.equal(view.rows[1].ask, null);
  assert.equal(view.bidNotional, 59328 + 59260 * 2 + 58750);
  assert.equal(view.askNotional, 59329 * 3 + 59499 + 60000 * 2);
  assert.equal(view.maxNotional, center[0].ask.notional);
  assert.equal(center[0].ask.intensity, 1);
  assert.equal(center[0].bid.intensity, center[0].bid.notional / view.maxNotional);
  assert.equal(deriveLiquidityBands(book, pivot, 250).bands.filter(band => band.lower === 59250).length, 2);
});

test('exact boundaries and all supported bin sizes preserve unique intervals', () => {
  for (const size of [25, 50, 100, 250]) {
    const p = 60000;
    const view = deriveLiquidityRows({ bids: [[p - 1, 1]], asks: [[p + 1, 1]] }, p, size, 2);
    assert.deepEqual(view.rows.map(row => row.lower), [p + 2 * size, p + size, p, p - size, p - 2 * size]);
    assert.equal(view.rows[2].containsPivot, true);
    assert.equal(view.rows[2].bid, null);
    assert.equal(view.rows[3].ask, null);
  }
  assert.deepEqual(deriveLiquidityRows(book, null, 250).rows, []);
  assert.deepEqual(deriveLiquidityRows(book, pivot, 0).rows, []);
  assert.deepEqual(deriveLiquidityRows({ bids: [], asks: [] }, pivot, 250).rows, []);
});

function fakeDocument() {
  class Element {
    children = [];
    dataset = {};
    style = {};
    textContent = '';
    parent = null;
    append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
    insertBefore(node, before) {
      node.remove();
      const index = before === null ? this.children.length : this.children.indexOf(before);
      assert.ok(index >= 0);
      this.children.splice(index, 0, node);
      node.parent = this;
    }
    remove() {
      if (!this.parent) return;
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    }
    replaceChildren(...nodes) {
      for (const child of [...this.children]) child.remove();
      this.append(...nodes);
    }
    setAttribute(key, value) { this[key] = value; }
  }
  const elements = new Map();
  const doc = {
    createElement() { return new Element(); },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    }
  };
  doc.getElementById('dashboardLiquidityRows').append(doc.getElementById('dashboardLiquidityMarker'));
  return doc;
}

test('renderer shows both bars on one row, positions marker and clears missing sides', () => {
  const doc = fakeDocument();
  const renderer = createLiquidityRenderer({ doc });
  const rows = doc.getElementById('dashboardLiquidityRows');
  const marker = doc.getElementById('dashboardLiquidityMarker');
  const prefs = { enabled: true, bucketSize: 250, mode: 'bars' };
  const snapshot = { status: 'LIVE', updatedAt: 1000, book };
  renderer.render(snapshot, prefs, 59328.1, 1000);
  const center = rows.children.filter(row => row.children[1]?.textContent === '59,250.00');
  assert.equal(center.length, 1);
  const row = center[0];
  const [left, , right] = row.children;
  assert.equal(row.dataset.side, 'both');
  assert.ok(parseFloat(left.children[0].style.width) > 0);
  assert.equal(right.children[0].style.width, '100%');
  assert.equal(rows.children[rows.children.indexOf(row) - 1], marker);
  assert.match(marker.textContent, /MID 59,328.50 · LAST 59,328.10 · IN BIN BELOW/);
  assert.equal(rows.children.length, 26);
  const next = { ...snapshot, book: { bids: new Map([[59260, 1]]), asks: new Map([[59500, 1]]) } };
  renderer.render(next, { ...prefs, mode: 'heatmap' }, 60000, 1000);
  assert.equal(rows.children.find(item => item.children[1]?.textContent === '59,250.00'), row);
  assert.equal(row.dataset.side, 'bid');
  assert.equal(right.children[0].style.width, '0%');
  assert.equal(right.children[0].style.opacity, '0');
  assert.equal(left.children[0].style.width, '100%');
  assert.doesNotMatch(marker.textContent, /LAST/);
  renderer.render(snapshot, prefs, pivot, 8000);
  assert.equal(rows.hidden, true);
  renderer.dispose();
  assert.deepEqual(rows.children, [marker]);
});
