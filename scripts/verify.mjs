import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeFiles = [
  'manifest.json',
  'icons/icon16.png','icons/icon32.png','icons/icon48.png','icons/icon128.png',
  'app/runtime.js','app/chart-runtime.js','app/notifications.js','app/background-alerts.js',
  'background/service-worker.js',
  'popup/popup.html','popup/popup.css','popup/popup.js',
  'dashboard/dashboard.html','dashboard/dashboard.css','dashboard/dashboard.js',
  'market/binance-rest.js','market/binance-klines.js','market/binance-websocket.js','market/connection-state.js','market/market-state.js','market/validators.js',
  'storage/settings.js','storage/chart-preferences.js','storage/session-diagnostics.js','storage/alert-targets.js','storage/alert-history.js',
  'ui/render.js','ui/dashboard-render.js','ui/chart.js','ui/status.js','ui/alert-center.js',
  'utils/backoff.js','utils/format.js','utils/time.js'
];
const requiredFiles = [
  ...runtimeFiles,
  'scripts/build-store.mjs','README.md','CHANGELOG.md','QA.md'
];
for (const file of [...new Set(requiredFiles)]) await access(path.join(root, file));

const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const popupHtml = await readFile(path.join(root, 'popup/popup.html'), 'utf8');
const dashboardHtml = await readFile(path.join(root, 'dashboard/dashboard.html'), 'utf8');
const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
const qa = await readFile(path.join(root, 'QA.md'), 'utf8');
const escapedVersion = manifest.version.replaceAll('.', '\\.');

assert.equal(manifest.manifest_version, 3);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, packageJson.version);
assert.equal(typeof manifest.name, 'string');
assert.ok(manifest.name.trim().length > 0);
assert.deepEqual(manifest.background, { service_worker: 'background/service-worker.js', type: 'module' });
assert.equal(manifest.content_scripts, undefined, 'Unexpected content scripts');
assert.equal(manifest.web_accessible_resources, undefined, 'Unexpected web-accessible resources');
assert.match(popupHtml, new RegExp(`V${escapedVersion}`));
assert.match(dashboardHtml, new RegExp(`V${escapedVersion}`));
assert.match(readme, new RegExp(`v${escapedVersion}`, 'i'));
assert.match(changelog, new RegExp(`## ${escapedVersion}\\b`));
assert.match(qa, new RegExp(`v${escapedVersion}`, 'i'));
assert.deepEqual(manifest.permissions, ['storage', 'notifications', 'alarms']);
assert.deepEqual(manifest.host_permissions, ['https://api.binance.com/*']);
assert.deepEqual(packageJson.dependencies ?? {}, {});
assert.equal(/unsafe-eval|unsafe-inline/i.test(JSON.stringify(manifest.content_security_policy)), false);

for (const [name, html] of [['popup', popupHtml], ['dashboard', dashboardHtml]]) {
  assert.match(html, /<html\s+lang=["']en["']/i, `${name} must declare English document language`);
  assert.match(html, /<meta\s+name=["']viewport["']/i, `${name} must declare a viewport`);
  assert.equal(/<(?:script|link|img)[^>]+(?:src|href)=["']https?:\/\//i.test(html), false, `${name} uses a remote UI asset`);
  assert.equal(/<script(?![^>]+src=)/i.test(html), false, `${name} contains inline script`);
  assert.equal(/\son\w+\s*=/i.test(html), false, `${name} contains inline event handler`);
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${name} contains duplicate HTML ids`);
}

function htmlIds(html) {
  return new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
}
function referencedIds(source) {
  return new Set([...source.matchAll(/getElementById\(['"]([^'"]+)['"]\)|getNode\(['"]([^'"]+)['"]\)/g)].map(m => m[1] ?? m[2]));
}
async function assertRefsExist(files, ids, label) {
  const source = (await Promise.all(files.map(file => readFile(path.join(root, file), 'utf8')))).join('\n');
  const missing = [...referencedIds(source)].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], `${label} references missing DOM ids`);
}
await assertRefsExist(['popup/popup.js','ui/render.js'], htmlIds(popupHtml), 'popup');
await assertRefsExist(['dashboard/dashboard.js','ui/dashboard-render.js','ui/chart.js'], htmlIds(dashboardHtml), 'dashboard');

const sourceFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.js')) sourceFiles.push(full);
  }
}
for (const dir of ['app','popup','dashboard','market','storage','ui','utils']) await walk(path.join(root, dir));
const source = (await Promise.all(sourceFiles.map(f => readFile(f, 'utf8')))).join('\n');
assert.equal(/\beval\s*\(|new\s+Function\s*\(|\.innerHTML\s*=/.test(source), false, 'Unsafe dynamic code or HTML assignment detected');
for (const file of sourceFiles) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.[^'"]+)['"]/g)) {
    await access(path.resolve(path.dirname(file), match[1]));
  }
}
for (const size of [16,32,48,128]) {
  const buffer = await readFile(path.join(root, `icons/icon${size}.png`));
  assert.equal(buffer.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(buffer.readUInt32BE(16), size);
  assert.equal(buffer.readUInt32BE(20), size);
}
assert.equal(runtimeFiles.length, 35, 'Unexpected runtime allowlist size');
console.log(`verify: manifest v${manifest.version}, popup/dashboard DOM, imports, permissions, CSP, explicit runtime allowlist and icon dimensions OK`);
