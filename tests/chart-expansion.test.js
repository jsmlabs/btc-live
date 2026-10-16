import assert from 'node:assert/strict';
import test from 'node:test';
import { createChartExpansion } from '../ui/chart-expansion.js';

test('chart modal synchronizes accessible expanded state on open and close', () => {
  const listeners = new Map();
  const attrs = new Map();
  const classes = new Set();
  const home = { hidden: false, append(node) { node.parentElement = this; } };
  const panel = { parentElement: home, classList: { add: v => classes.add(v), remove: v => classes.delete(v) }, querySelectorAll: () => [] };
  const button = {
    textContent: 'Expand chart', attrs,
    setAttribute: (name, value) => attrs.set(name, value),
    addEventListener: (name, fn) => listeners.set('button:' + name, fn),
    removeEventListener: name => listeners.delete('button:' + name),
    focus() {}
  };
  const dialog = {
    open: false,
    append(node) { node.parentElement = this; },
    showModal() { this.open = true; },
    close() { this.open = false; listeners.get('dialog:close')?.(); },
    addEventListener: (name, fn) => listeners.set('dialog:' + name, fn),
    removeEventListener: name => listeners.delete('dialog:' + name)
  };
  const root = {
    querySelector: () => panel,
    getElementById: id => id === 'dashboardChartDialog' ? dialog : button,
    documentElement: { classList: { add() {}, remove() {} } },
    defaultView: { scrollY: 0, scrollTo() {} }
  };
  let redraws = 0;
  const control = createChartExpansion({ root, redraw: () => redraws++ });
  assert.equal(attrs.get('aria-expanded'), 'false');
  control.setExpanded(true);
  assert.equal(attrs.get('aria-expanded'), 'true');
  assert.equal(attrs.get('aria-pressed'), 'true');
  assert.equal(control.expanded(), true);
  control.setExpanded(false);
  assert.equal(attrs.get('aria-expanded'), 'false');
  assert.equal(attrs.get('aria-pressed'), 'false');
  assert.equal(panel.parentElement, home);
  assert.equal(control.expanded(), false);
  assert.ok(redraws >= 2);
  control.dispose();
});
