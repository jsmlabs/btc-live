import assert from 'node:assert/strict';
import { copyFile, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const output = path.join(root, 'dist', `btc-live-chromium-v${manifest.version}-store`);
const staging = `${output}.tmp`;
const storeFiles = [
  'manifest.json',
  'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png',
  'app/runtime.js', 'app/chart-runtime.js', 'app/notifications.js', 'app/background-alerts.js',
  'background/service-worker.js',
  'popup/popup.html', 'popup/popup.css', 'popup/popup.js',
  'dashboard/dashboard.html', 'dashboard/dashboard.css', 'dashboard/dashboard.js',
  'market/binance-rest.js', 'market/binance-klines.js', 'market/binance-websocket.js', 'market/connection-state.js', 'market/market-state.js', 'market/validators.js',
  'storage/settings.js', 'storage/chart-preferences.js', 'storage/session-diagnostics.js', 'storage/alert-targets.js', 'storage/alert-history.js',
  'ui/render.js', 'ui/dashboard-render.js', 'ui/chart.js', 'ui/status.js', 'ui/alert-center.js',
  'utils/backoff.js', 'utils/format.js', 'utils/time.js'
];

await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });

try {
  for (const file of storeFiles) {
    const destination = path.join(staging, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(root, file), destination);
  }

  const builtManifest = JSON.parse(await readFile(path.join(staging, 'manifest.json'), 'utf8'));
  assert.equal(builtManifest.version, manifest.version);

  const files = await listFiles(staging);
  assert.deepEqual(files, [...storeFiles].sort(), 'Store build differs from the explicit runtime allowlist');

  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
  console.log(`build:store: ${output} (${files.length} runtime files)`);
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
}

async function listFiles(dir, base = dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(full, base));
    else files.push(path.relative(base, full).replaceAll(path.sep, '/'));
  }
  return files.sort();
}
