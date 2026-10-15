/** Optional real-DOM regression checks. Synthetic fixtures only; no exchange traffic or MV3 acceptance. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const captureDir = process.env.UI_SCREENSHOT_DIR;
if (captureDir) await mkdir(captureDir, { recursive: true });
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const filename = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', mime[path.extname(filename)] ?? 'application/octet-stream');
    response.end(await readFile(filename));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const key = 'btc-live-ui-mock-storage';
    const listeners = new Set();
    globalThis.browser = { storage: {
      local: {
        async get(name) {
          const data = JSON.parse(localStorage.getItem(key) ?? '{}');
          if (typeof name === 'string') return Object.hasOwn(data, name) ? { [name]: data[name] } : {};
          return data;
        },
        async set(next) {
          if (globalThis.__failTerminalSaves && Object.hasOwn(next, 'btcLiveTerminalV1')) throw Error('UI fixture storage failure');
          const data = JSON.parse(localStorage.getItem(key) ?? '{}');
          const changes = Object.fromEntries(Object.entries(next).map(([name, newValue]) => [name, { oldValue: data[name], newValue }]));
          localStorage.setItem(key, JSON.stringify({ ...data, ...next }));
          for (const listener of listeners) listener(changes, 'local');
        }
      },
      onChanged: { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener) }
    } };
  });
  // Every external request is intercepted. Prices below are deliberately synthetic test values.
  let offline = false;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === base) { await route.continue(); return; }
    if (url.origin !== 'https://fapi.binance.com' || offline) { await route.abort(); return; }
    const now = Date.now();
    let data;
    if (url.pathname.endsWith('/ticker/24hr')) data = { symbol: 'BTCUSDT', lastPrice: '100000', openPrice: '99000',
      highPrice: '101000', lowPrice: '98000', priceChange: '1000', priceChangePercent: String(1000 / 99000 * 100),
      volume: '25000', quoteVolume: '2500000000', closeTime: now, lastId: 100 };
    else if (url.pathname.endsWith('/ticker/bookTicker')) data = { symbol: 'BTCUSDT', bidPrice: '99999.90', askPrice: '100000.10', time: now };
    else if (url.pathname.endsWith('/klines')) {
      const durations = { '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000, '4h': 14400000 };
      const duration = durations[url.searchParams.get('interval')] ?? 300000;
      const end = Math.floor(now / duration) * duration;
      data = Array.from({ length: 240 }, (_, index) => {
        const at = end - (239 - index) * duration;
        const open = 99000 + index * 4 + Math.sin(index * .3) * 120;
        const close = open + Math.cos(index * .7) * 45;
        return [at, String(open), String(Math.max(open, close) + 30), String(Math.min(open, close) - 30), String(close), '20', at + duration - 1];
      });
    } else if (url.pathname.endsWith('/depth')) data = { lastUpdateId: 100, bids: [['99999.9', '2']], asks: [['100000.1', '2']] };
    else { await route.abort(); return; }
    await route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } });
  });
  // Intentionally idle sockets: REST is exercised; live stream acceptance is out of scope.
  await context.routeWebSocket('**', () => {});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const shot = async name => { if (captureDir) await page.screenshot({ path: path.join(captureDir, `${name}.png`), fullPage: true }); };
  const nav = view => page.locator(`[data-workspace-target="${view}"]`);
  const noOverflow = async label => {
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(dimensions.width <= dimensions.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
  };
  await page.goto(`${base}/dashboard/dashboard.html`);
  await page.waitForFunction(() => document.querySelector('#dashboardPrice').textContent === '100,000.00');
  await page.waitForFunction(() => document.querySelectorAll('#dashboardChartSvg .chart-body').length > 0);
  await shot('dashboard-live-desktop');
  for (const width of [1920, 1440, 1024, 800, 560, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ['live', 'analytics', 'replay', 'alerts', 'diagnostics', 'settings']) {
      await nav(view).click();
      await noOverflow(`${width}/${view}`);
      assert.equal(await nav(view).getAttribute('aria-pressed'), 'true');
      if ([1440, 390].includes(width)) await shot(`${view}-${width}`);
    }
  }
  results.push('42 workspace/viewport combinations without page overflow');
  await nav('live').click();
  for (const width of [1440, 800, 560, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const selector of ['#terminalViewOptions', '.chart-menu:nth-of-type(1)', '.chart-menu:nth-of-type(2)', '.chart-menu:nth-of-type(3)', '.chart-menu:nth-of-type(4)']) {
      const menu = page.locator(selector);
      await menu.locator('summary').click();
      const bounds = await menu.locator(selector === '#terminalViewOptions' ? '.presentation-menu-content' : '.chart-menu-content').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${selector} clipped at ${width}: ${JSON.stringify(bounds)}`);
      await menu.locator('summary').focus(); await page.keyboard.press('Escape');
    }
  }
  results.push('view and chart menus stay within the viewport at five widths');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav('live').click();
  await nav('live').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await nav('analytics').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('End');
  assert.equal(await nav('settings').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await nav('live').getAttribute('aria-pressed'), 'true');
  results.push('workspace keyboard navigation');

  await page.locator('#terminalViewOptions summary').click();
  await page.selectOption('#terminalDensity', 'analysis');
  await page.evaluate(async () => {
    const { renderDashboard } = await import('/ui/dashboard-render.js');
    const { createInitialMarketState } = await import('/market/market-state.js');
    const { DEFAULT_SETTINGS } = await import('/storage/settings.js');
    renderDashboard({ state: createInitialMarketState(), settings: DEFAULT_SETTINGS, online: true });
  });
  assert.equal(await page.locator('#dashboardShell').getAttribute('data-density'), 'analysis');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#terminalViewOptions').getAttribute('open'), null);
  await page.locator('#terminalCommand').click();
  const query = page.locator('#terminalCommandQuery');
  await query.fill('density: compact');
  await query.press('Enter');
  assert.equal(await page.locator('#dashboardShell').getAttribute('data-density'), 'compact');
  await page.waitForFunction(() => document.activeElement.id === 'terminalCommand');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#dashboardShell').dataset.density === 'compact');
  await page.locator('#terminalCommand').click();
  await query.fill('no such command');
  assert.equal(await query.getAttribute('aria-activedescendant'), null);
  await query.press('ArrowDown'); await query.press('Enter');
  await query.fill('');
  await query.press('ArrowDown');
  assert.ok(await query.getAttribute('aria-activedescendant'));
  await page.locator('#terminalPaletteClose').click();
  await page.locator('#terminalViewOptions summary').click();
  await page.selectOption('#dashboardWorkspacePreset', 'simple');
  await page.keyboard.press('Escape');
  await page.locator('#terminalCommand').click();
  await query.fill('Open Analytics');
  assert.equal(await page.locator('.terminal-command-item').count(), 0);
  await query.press('Escape');
  await page.locator('#terminalViewOptions summary').click();
  await page.selectOption('#dashboardWorkspacePreset', 'advanced');
  await page.evaluate(() => { globalThis.__failTerminalSaves = true; });
  await page.selectOption('#terminalDensity', 'analysis');
  await page.waitForFunction(() => document.querySelector('#terminalActionFeedback').textContent.includes('could not be saved'));
  await page.evaluate(() => { globalThis.__failTerminalSaves = false; });
  await page.selectOption('#terminalDensity', 'comfortable');
  await page.keyboard.press('Escape');
  results.push('density survives repaint/reload; save failure feedback; palette selection, empty state, dismissal, focus return and preset restrictions');

  await page.locator('#terminalFocus').click();
  assert.equal(await page.locator('#dashboardShell').getAttribute('data-terminal-focus'), 'true');
  await nav('analytics').click();
  assert.equal(await page.locator('#dashboardShell').getAttribute('data-terminal-focus'), 'false');
  await nav('live').click();
  await page.locator('#terminalFocus').click(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('#terminalFocus').getAttribute('aria-pressed'), 'false');
  await page.locator('#dashboardChartFocus').click();
  assert.equal(await page.locator('.chart-panel').evaluate(node => node.classList.contains('chart-focus')), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dashboardChartFocus').getAttribute('aria-pressed'), 'false');
  await page.locator('.chart-menu').first().locator('summary').click();
  await page.locator('.chart-menu').nth(1).locator('summary').click();
  assert.equal(await page.locator('.chart-menu[open]').count(), 1);
  await page.locator('#dashboardWorkspaceTitle').click();
  assert.equal(await page.locator('.chart-menu[open]').count(), 0);
  results.push('chart focus exits on navigation/Escape; disclosure menus dismiss and remain exclusive');

  await nav('alerts').click();
  await page.locator('#dashboardTargetPrice').fill('101000');
  await page.locator('#dashboardTargetLabel').fill('UI smoke fixture');
  await page.locator('#dashboardTargetForm button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#dashboardTargetList').textContent.includes('UI smoke fixture'));
  await page.locator('#dashboardTargetList .mini-button.danger').click();
  results.push('price target create/remove through the visible form');

  await nav('replay').click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.locator('#dashboardEventSessionName').evaluate(node => node.clientWidth) >= 140, `session input width at ${width}`);
    assert.ok(await page.locator('#dashboardEventBookmarkNote').evaluate(node => node.clientWidth) >= 140, `bookmark input width at ${width}`);
  }
  results.push('replay text inputs retain usable width');

  for (const width of [408, 360, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${base}/popup/popup.html`);
    await page.waitForFunction(() => document.querySelector('#currentPrice').textContent === '100,000.00');
    await noOverflow(`popup/${width}`);
    if (width === 408) await shot('popup');
    await page.locator('#settingsButton').click();
    await noOverflow(`popup settings/${width}`);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#settingsView').isVisible(), false);
    assert.equal(await page.locator('#settingsButton').evaluate(node => node === document.activeElement), true);
  }
  const popup = page.waitForEvent('popup');
  await page.locator('#openTerminalButton').click();
  const terminal = await popup;
  await terminal.waitForURL(`${base}/dashboard/dashboard.html`);
  await terminal.close();
  results.push('popup/settings at 408/360/320px; Escape focus restoration; terminal launch');

  offline = true;
  await page.goto(`${base}/dashboard/dashboard.html`);
  await context.setOffline(true);
  await page.waitForFunction(() => document.querySelector('#dashboardStatusText').textContent === 'OFFLINE');
  assert.equal(await page.locator('#dashboardPrice').textContent(), '—');
  assert.equal(await page.locator('#dashboardRetryButton').isVisible(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow('offline mobile');
  await shot('offline-mobile');
  results.push('offline state exposes missing price and retry');
  assert.deepEqual(errors, [], 'uncaught page errors');
  console.log(JSON.stringify({ browser: browser.version(), data: 'synthetic REST fixtures; idle intercepted sockets; no live exchange', results, pageErrors: errors }, null, 2));
  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
