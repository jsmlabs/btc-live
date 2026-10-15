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
          if (Object.hasOwn(next, 'btcLiveAlertTargets')) {
            if (globalThis.__failTargetSaves) throw Error('UI fixture target save failed');
            if (globalThis.__targetSaveDelayMs) await new Promise(resolve => setTimeout(resolve, globalThis.__targetSaveDelayMs));
          }
          if (globalThis.__failHistorySaves && Object.hasOwn(next, 'btcLiveAlertHistory')) throw Error('UI fixture history save failed');
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
  const shot = async (name, fullPage = true) => { if (captureDir) await page.screenshot({ path: path.join(captureDir, `${name}.png`), fullPage }); };
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
    if (width <= 560) {
      assert.equal(await nav('live').evaluate(button => button.getBoundingClientRect().height >= 44), true);
      const visibleNav = await page.locator('.workspace-link').evaluateAll(buttons => buttons.every(button => {
        const rect = button.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth;
      }));
      assert.equal(visibleNav, true, `all workspaces discoverable at ${width}`);
    }
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
  const references = page.locator('.chart-reference-levels');
  assert.equal(await references.getAttribute('open'), null);
  await references.locator('summary').click();
  assert.equal(await page.locator('#dashboardChartLevelCurrent').isVisible(), true);
  await references.locator('summary').click();
  results.push('reference prices remain available through progressive disclosure');

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
  assert.equal(await page.locator('#dashboardChartDialog').evaluate(node => node.open), true);
  assert.equal(await page.locator('#dashboardChartDialog').evaluate(node => node.matches(':modal')), true);
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press(i < 20 ? 'Tab' : 'Shift+Tab');
    assert.equal(await page.locator('#dashboardChartDialog').evaluate(node => node.contains(document.activeElement) || document.activeElement === document.body), true);
  }
  await nav('settings').evaluate(node => node.focus());
  assert.equal(await page.locator('#dashboardChartDialog').evaluate(node => node.contains(document.activeElement) || document.activeElement === document.body), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dashboardChartFocus').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.chart-section > .chart-panel').count(), 1);
  // Expanded charts remain scrollable on short screens, with a reachable restore action.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('#dashboardChartFocus').click();
  await noOverflow('expanded chart short viewport');
  const expandedBounds = await page.locator('#dashboardChartDialog').boundingBox();
  assert.ok(expandedBounds.y >= 0 && expandedBounds.y + expandedBounds.height <= 568, 'expanded chart fits the short viewport');
  await shot('expanded-chart-320', false);
  await page.locator('#dashboardChartFocus').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#dashboardChartFocus').click();
  await page.keyboard.press('Control+k');
  await query.fill('Open Analytics'); await query.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-workspace-target="analytics"]').getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('#dashboardChartDialog').evaluate(node => node.open), false);
  assert.equal(await page.locator('.chart-section > .chart-panel').count(), 1);
  await page.waitForFunction(() => document.activeElement.id === 'dashboardWorkspaceTitle');
  await nav('live').click();
  await page.locator('#terminalFocus').click();
  await page.locator('#dashboardChartFocus').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dashboardChartDialog').evaluate(node => node.open), false);
  assert.equal(await page.locator('#terminalFocus').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#terminalFocus').getAttribute('aria-pressed'), 'false');
  await page.locator('.chart-menu').first().locator('summary').click();
  await page.locator('.chart-menu').nth(1).locator('summary').click();
  assert.equal(await page.locator('.chart-menu[open]').count(), 1);
  await page.locator('#dashboardWorkspaceTitle').click();
  assert.equal(await page.locator('.chart-menu[open]').count(), 0);
  results.push('native chart modal isolates background controls, restores DOM, handles short viewports and exits before page focus mode; menus remain exclusive');

  await nav('alerts').click();
  await page.locator('#dashboardTargetPrice').fill('101000');
  await page.locator('#dashboardTargetLabel').fill('UI smoke fixture');
  assert.equal(await page.locator('#dashboardClearHistory').isDisabled(), true);
  await page.evaluate(() => {
    globalThis.__targetSaveDelayMs = 150;
    const form = document.getElementById('dashboardTargetForm'); form.requestSubmit(); form.requestSubmit();
  });
  await page.waitForFunction(() => document.querySelector('#dashboardTargetList').textContent.includes('UI smoke fixture'));
  assert.equal(await page.locator('#dashboardTargetList .alert-target-item').count(), 1);
  await page.waitForFunction(() => document.querySelector('#dashboardTargetFeedback').dataset.tone === 'positive');
  await page.evaluate(() => { globalThis.__targetSaveDelayMs = 0; });
  await page.locator('#dashboardTargetList button[data-action="toggle"]').click();
  await page.waitForFunction(() => document.querySelector('#dashboardTargetList').textContent.includes('paused'));
  assert.equal(await page.locator('#dashboardTargetList button[data-action="toggle"]').textContent(), 'Resume');
  await page.evaluate(() => { globalThis.__failTargetSaves = true; });
  await page.locator('#dashboardTargetList button[data-action="toggle"]').click();
  await page.waitForFunction(() => document.querySelector('#dashboardTargetFeedback').dataset.tone === 'negative');
  assert.equal(await page.locator('#dashboardTargetList .alert-target-item').getAttribute('data-enabled'), 'false');
  await page.evaluate(() => { globalThis.__failTargetSaves = false; });
  await page.locator('#dashboardTargetList .mini-button.danger').click();
  await page.waitForFunction(() => !document.querySelector('#dashboardTargetList .alert-target-item'));
  await page.locator('#dashboardTargetPrice').fill('102000');
  await page.evaluate(() => { globalThis.__failTargetSaves = true; });
  await page.locator('#dashboardTargetForm button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#dashboardTargetFeedback').dataset.tone === 'negative');
  assert.equal(await page.locator('#dashboardTargetPrice').inputValue(), '102000');
  await page.evaluate(() => { globalThis.__failTargetSaves = false; });
  await shot('alert-save-feedback');
  results.push('targets reject duplicate submits, show paused state and recover from failed saves without clearing input');

  await page.locator('#dashboardTestNotification').click();
  await page.waitForFunction(() => document.querySelector('#dashboardNotificationFeedback').dataset.tone === 'warning');
  await page.evaluate(() => {
    globalThis.__notificationCalls = 0;
    globalThis.browser.notifications = { create: async () => {
      globalThis.__notificationCalls++;
      await new Promise(resolve => setTimeout(resolve, 150));
      if (globalThis.__notificationReject) throw Error('UI fixture notification denied');
    } };
    document.getElementById('dashboardTestNotification').click();
    document.getElementById('dashboardTestNotification').click();
  });
  await page.waitForFunction(() => document.querySelector('#dashboardNotificationFeedback').dataset.tone === 'positive');
  assert.equal(await page.evaluate(() => globalThis.__notificationCalls), 1);
  assert.match(await page.locator('#dashboardNotificationFeedback').textContent(), /delivery is not guaranteed/);
  await page.evaluate(() => { globalThis.__notificationReject = true; });
  await page.locator('#dashboardTestNotification').click();
  await page.waitForFunction(() => document.querySelector('#dashboardNotificationFeedback').dataset.tone === 'negative');
  assert.equal(await page.locator('#dashboardTestNotification').isDisabled(), false);
  results.push('notification test shows unavailable/accepted/rejected states, prevents duplicate requests and restores controls');
  await page.evaluate(async () => {
    await globalThis.browser.storage.local.set({ btcLiveAlertHistory: [{ at: Date.now(), type: 'target', status: 'sent', title: 'UI history fixture' }] });
    globalThis.__failHistorySaves = true;
  });
  await page.waitForFunction(() => !document.getElementById('dashboardClearHistory').disabled);
  await page.locator('#dashboardClearHistory').click();
  await page.waitForFunction(() => document.getElementById('dashboardHistoryFeedback').dataset.tone === 'negative');
  assert.match(await page.locator('#dashboardHistoryList').textContent(), /UI history fixture/);
  await page.evaluate(() => { globalThis.__failHistorySaves = false; });
  await page.locator('#dashboardClearHistory').click();
  await page.waitForFunction(() => document.getElementById('dashboardHistoryFeedback').dataset.tone === 'positive');
  assert.equal(await page.locator('#dashboardClearHistory').isDisabled(), true);
  results.push('history clear handles failure, preserves entries and disables itself when empty');

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
    await page.locator('#testNotificationButton').click();
    await page.waitForFunction(() => document.querySelector('#settingNotificationFeedback').dataset.tone === 'warning');
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
  assert.match(await page.locator('#dashboardChartSvg').getAttribute('aria-label'), /offline|unavailable/);
  assert.ok(await page.locator('#dashboardChartSvg').evaluate(svg => Number(svg.getAttribute('viewBox').split(' ')[2])) < 600);
  results.push('offline state exposes missing price and retry');
  assert.deepEqual(errors, [], 'uncaught page errors');
  console.log(JSON.stringify({ browser: browser.version(), data: 'synthetic REST fixtures; idle intercepted sockets; no live exchange', results, pageErrors: errors }, null, 2));
  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
