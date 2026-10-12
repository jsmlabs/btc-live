/** Reproducible synthetic render-work benchmark; does not emulate a real browser. */
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { renderBtcChart } from '../ui/chart.js';

const mode = process.argv.includes('--baseline') ? 'baseline' : 'optimized';
const outputIndex = process.argv.indexOf('--output');
const counters = { svgRebuilds: 0, svgNodesCreated: 0, chartRenders: 0, marketUpdates: 120, duplicateCalls: 120, unchangedRefreshes: 40 };
const domNodes = new Map();
function newNode() {
  return {
    dataset: {}, checked: false, hidden: false, textContent: '',
    setAttribute() {}, append() {},
    replaceChildren() { counters.svgRebuilds++; }
  };
}
globalThis.document = {
  getElementById(id) {
    if (!domNodes.has(id)) domNodes.set(id, newNode());
    return domNodes.get(id);
  },
  createElementNS() { counters.svgNodesCreated++; return newNode(); }
};
const BASE = 1_800_000_000_000;
const candles = Array.from({ length: 120 }, (_, i) => {
  const price = 100_000 + i * 3;
  return { openTime: BASE + i * 300_000, closeTime: BASE + (i + 1) * 300_000 - 1,
    open: price, high: price + 100, low: price - 100, close: price + 4, volume: 15 + i % 4 };
});
const chart = { preferences: { interval: '5m', mode: 'candles', showVolume: true },
  candles, status: 'READY', lastLoadedAt: BASE, errorMessage: null };
const market = { currentPrice: 100_400, open24h: 99_800, high24h: 101_100, low24h: 99_100 };

const draw = () => {
  counters.chartRenders++;
  renderBtcChart(chart, market, BASE + 250_000);
  // Baseline mode reproduces the old unconditional-SVG-build policy.
  if (mode === 'baseline') domNodes.delete('dashboardChartSvg');
};
let submit = draw;
let flush = () => {};
if (mode === 'optimized') {
  const { createRenderScheduler } = await import('../ui/render-scheduler.js');
  const frames = [];
  const scheduler = createRenderScheduler(draw, {
    requestFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelFrame: () => {}
  });
  submit = () => scheduler.schedule();
  flush = () => { const callbacks = frames.splice(0); callbacks.forEach((fn) => fn()); };
}
// Initial chart, followed by bursts of four live events with duplicate UI notifications.
const started = performance.now();
submit(); flush();
for (let i = 0; i < counters.marketUpdates; i++) {
  market.currentPrice = 100_400 + i * 0.01;
  submit(); submit();
  if (i % 4 === 3) flush();
}
for (let i = 0; i < counters.unchangedRefreshes; i++) { submit(); flush(); }
const elapsedMs = performance.now() - started;
const result = { mode, scenario: '120 updates (2 callbacks each), 4 updates/frame; 40 unchanged refreshes; 120 candles',
  ...counters, elapsedMs: Number(elapsedMs.toFixed(2)) };
if (outputIndex !== -1 && process.argv[outputIndex + 1]) {
  await writeFile(process.argv[outputIndex + 1], `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
