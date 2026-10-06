import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHART_PREFERENCES_STORAGE_KEY,
  DEFAULT_CHART_PREFERENCES,
  loadChartPreferences,
  sanitizeChartPreferences,
  saveChartPreferences
} from '../storage/chart-preferences.js';

test('chart preferences sanitize interval, mode and volume independently', () => {
  assert.deepEqual(sanitizeChartPreferences({ interval: '1m', mode: 'line', showVolume: false }), {
    interval: '1m', mode: 'line', showVolume: false
  });
  assert.deepEqual(sanitizeChartPreferences({ interval: '1h', mode: 'bars', showVolume: 'yes' }), DEFAULT_CHART_PREFERENCES);
});

test('chart preferences round-trip through local extension storage', async (t) => {
  const previousChrome = globalThis.chrome;
  t.after(() => {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  });
  const store = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) { return { [key]: store[key] }; },
        async set(value) { Object.assign(store, value); }
      }
    }
  };

  await saveChartPreferences({ interval: '15m', mode: 'line', showVolume: false });
  assert.deepEqual(store[CHART_PREFERENCES_STORAGE_KEY], { interval: '15m', mode: 'line', showVolume: false });
  assert.deepEqual(await loadChartPreferences(), { interval: '15m', mode: 'line', showVolume: false });
});
