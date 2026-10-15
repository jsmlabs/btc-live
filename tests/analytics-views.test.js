import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTICS_VIEWS, bindAnalyticsViews } from '../ui/analytics-views.js';

function fixture() {
  let focused = null;
  const nav = { dataset: {}, handlers: new Map(),
    addEventListener(name, fn) { this.handlers.set(name, fn); },
    removeEventListener(name) { this.handlers.delete(name); } };
  const controls = ANALYTICS_VIEWS.map(view => ({ dataset: { analyticsView: view }, attributes: new Map(), handlers: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    addEventListener(name, fn) { this.handlers.set(name, fn); },
    removeEventListener(name) { this.handlers.delete(name); }, focus() { focused = view; } }));
  const title = { textContent: '' }, description = { textContent: '' }, changes = [];
  const doc = { querySelector: () => nav, querySelectorAll: () => controls,
    getElementById: id => id === 'analyticsViewTitle' ? title : description };
  const controller = bindAnalyticsViews(doc, { onChange: view => changes.push(view) });
  return { nav, controls, title, description, changes, controller, focus: () => focused };
}

test('Analytics views update context and keep exactly one keyboard stop', () => {
  const f = fixture();
  assert.equal(f.nav.dataset.analyticsActiveView, 'all');
  assert.equal(f.controller.choose('behavior'), true);
  assert.equal(f.title.textContent, 'Liquidity behavior');
  assert.match(f.description.textContent, /depth/);
  assert.deepEqual(f.controls.map(c => c.tabIndex), [-1, -1, -1, 0]);
  assert.deepEqual(f.controls.map(c => c.attributes.get('aria-pressed')), ['false', 'false', 'false', 'true']);
  assert.equal(f.controller.choose('unknown'), false);
  assert.equal(f.nav.dataset.analyticsActiveView, 'behavior');
  assert.deepEqual(f.changes, ['all', 'behavior']);
  f.controller.dispose();
});

test('Analytics keyboard selection wraps and handles Home/End without stealing browser shortcuts', () => {
  const f = fixture();
  let prevented = 0;
  const key = (key, index, extra = {}) => f.nav.handlers.get('keydown')({ key, target: f.controls[index], preventDefault: () => prevented++, ...extra });
  key('ArrowLeft', 0); assert.equal(f.focus(), 'behavior');
  key('Home', 3); assert.equal(f.focus(), 'all');
  key('End', 0); assert.equal(f.focus(), 'behavior');
  key('ArrowRight', 3); assert.equal(f.focus(), 'all');
  key('ArrowRight', 0, { altKey: true }); assert.equal(prevented, 4);
  f.controller.dispose();
  assert.equal(f.nav.handlers.size, 0);
  assert.ok(f.controls.every(c => c.handlers.size === 0));
});
