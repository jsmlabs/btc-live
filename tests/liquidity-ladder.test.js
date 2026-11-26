import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLiquidityBands, deriveLiquidityRows, createLiquidityRenderer } from '../ui/liquidity.js';

const book = {
  bids: new Map([[59328, 1], [59260, 2], [58750, 1], [54000, 100]]),
  asks: new Map([[59329, 3], [59499, 1], [60000, 2], [65000, 100]])
};
const pivot = 59328.5;

test('side-specific rounding separates the sides and preserves actual notional', () => {
  const view = deriveLiquidityRows(book, pivot, 250, 3);
  assert.deepEqual(view.rows.map(row => row.price), [60000, 59750, 59500, 59250, 59000, 58750]);
  const bid = view.rows[3];
  const ask = view.rows[2];
  assert.equal(bid.bid.notional, 59328 + 59260 * 2);
  assert.equal(ask.ask.notional, 59329 * 3 + 59499);
  assert.equal(bid.ask, null);
  assert.equal(ask.bid, null);
  assert.equal(view.rows[1].ask, null);
  assert.equal(view.bidNotional, 59328 + 59260 * 2 + 58750);
  assert.equal(view.askNotional, 59329 * 3 + 59499 + 60000 * 2);
  assert.equal(view.maxNotional, ask.ask.notional);
  assert.equal(ask.ask.intensity, 1);
  assert.equal(bid.bid.intensity, bid.bid.notional / view.maxNotional);
  // Existing history/analytics retain their original half-open bucket contract.
  assert.equal(deriveLiquidityBands(book, pivot, 250).bands.filter(band => band.lower === 59250).length, 2);
});

test('exact midpoint and order boundaries work for all supported bin sizes', () => {
  for (const size of [25, 50, 100, 250]) {
    const p = 60000;
    for (const mid of [p, p + .5, p - .5]) {
      const view = deriveLiquidityRows({ bids: [[p - size, 2], [mid - 1, 1]], asks: [[p + size, 3], [mid + 1, 1]] }, mid, size, 3);
      assert.equal(view.rows.length, 6);
      assert.equal(new Set(view.rows.map(row => row.price)).size, 6);
      assert.ok(view.rows.every(row => row.side === 'bid' ? row.price < mid && row.ask === null : row.price > mid && row.bid === null));
      assert.ok(view.rows.every((row, i) => i === 0 || view.rows[i - 1].price > row.price));
      assert.equal(view.bidNotional, (p - size) * 2 + mid - 1);
      assert.equal(view.askNotional, (p + size) * 3 + mid + 1);
    }
    const exact = deriveLiquidityRows({ bids: [[p - size, 2]], asks: [[p + size, 3]] }, p, size, 2);
    assert.deepEqual(exact.rows.map(row => row.price), [p + 2 * size, p + size, p - size, p - 2 * size]);
    assert.equal(exact.rows[1].ask.levels, 1);
    assert.equal(exact.rows[2].bid.levels, 1);
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

test('renderer separates bars, positions marker and clears missing levels', () => {
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
  assert.equal(row.dataset.side, 'bid');
  assert.ok(parseFloat(left.children[0].style.width) > 0);
  assert.equal(right.children[0].style.width, '0%');
  const askRow = rows.children.find(item => item.children[1]?.textContent === '59,500.00');
  assert.equal(askRow.children[2].children[0].style.width, '100%');
  assert.equal(askRow.children[0].children[0].style.width, '0%');
  assert.equal(rows.children[rows.children.indexOf(row) - 1], marker);
  assert.equal(rows.children[rows.children.indexOf(marker) - 1], askRow);
  assert.match(marker.textContent, /MID 59,328.50 · LAST 59,328.10/);
  assert.equal(rows.children.length, 25);
  const next = { ...snapshot, book: { bids: new Map([[59260, 1]]), asks: new Map([[59500, 1]]) } };
  renderer.render(next, { ...prefs, mode: 'heatmap' }, 60000, 1000);
  assert.equal(rows.children.find(item => item.children[1]?.textContent === '59,250.00'), row);
  assert.equal(row.dataset.side, 'bid');
  assert.equal(right.children[0].style.width, '0%');
  assert.equal(right.children[0].style.opacity, '0');
  assert.equal(left.children[0].style.width, '100%');
  assert.doesNotMatch(marker.textContent, /LAST/);
  const shifted = { ...snapshot, book: { bids: new Map([[59501, 1]]), asks: new Map([[59502, 1]]) } };
  renderer.render(shifted, prefs, 59501.5, 1000);
  assert.equal(rows.children.find(item => item.children[1]?.textContent === '59,500.00'), askRow);
  assert.equal(askRow.dataset.side, 'bid');
  assert.equal(askRow.children[2].children[0].style.width, '0%');
  assert.ok(parseFloat(askRow.children[0].children[0].style.width) > 0);
  renderer.render(snapshot, prefs, pivot, 8000);
  assert.equal(rows.hidden, true);
  renderer.dispose();
  assert.deepEqual(rows.children, [marker]);
});

test('liquidity hover details survive redraws without resetting native tooltips', () => {
  const doc = fakeDocument();
  const renderer = createLiquidityRenderer({ doc });
  const rows = doc.getElementById('dashboardLiquidityRows');
  const prefs = { enabled: true, bucketSize: 250, mode: 'bars' };
  const snapshot = { status: 'LIVE', updatedAt: 1000, book };
  renderer.render(snapshot, prefs, 59328.1, 1000);
  const hovered = rows.children.find(row => row.children[1]?.textContent === '59,250.00');
  assert.ok(hovered);
  assert.match(hovered.dataset.tooltip, /BID.*0s old/);
  assert.equal(hovered.title, undefined, 'native title must not reset on live updates');
  renderer.render(snapshot, prefs, 59328.1, 2500);
  assert.equal(rows.children.find(row => row.children[1]?.textContent === '59,250.00'), hovered);
  assert.match(hovered.dataset.tooltip, /BID.*1s old/);
  assert.equal(hovered.title, undefined);
  renderer.render(snapshot, { ...prefs, mode: 'heatmap' }, 59328.1, 2500);
  assert.equal(rows.children.find(row => row.children[1]?.textContent === '59,250.00'), hovered);
  assert.match(hovered.getAttribute?.('aria-label') ?? hovered['aria-label'], /BID.*1s old/);
  renderer.dispose();
});
