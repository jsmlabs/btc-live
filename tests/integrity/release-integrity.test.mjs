import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');

const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const sourceManifest = JSON.parse(await readFile(resolve(src, 'manifest.base.json'), 'utf8'));

const EXPECTED_PERMISSIONS = ['storage'];
const EXPECTED_HOST_PERMISSIONS = ['https://api.binance.com/*'];
const REQUIRED_FILES = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'market/binance-rest.js',
  'market/binance-websocket.js',
  'market/market-state.js',
  'market/validators.js',
  'storage/settings.js',
  'ui/render.js',
  'ui/status.js',
  'utils/backoff.js',
  'utils/format.js',
  'utils/time.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function normalize(paths) {
  return [...paths].sort();
}

function assertCoreManifest(manifest, target) {
  assert.equal(manifest.manifest_version, 3, `${target}: manifest_version must remain 3`);
  assert.equal(manifest.version, packageJson.version, `${target}: manifest version must match package.json`);
  assert.deepEqual(normalize(manifest.permissions ?? []), normalize(EXPECTED_PERMISSIONS), `${target}: permissions changed`);
  assert.deepEqual(normalize(manifest.host_permissions ?? []), normalize(EXPECTED_HOST_PERMISSIONS), `${target}: host permissions changed`);
  assert.equal(manifest.action?.default_popup, 'popup/popup.html', `${target}: popup entry changed`);

  assert.equal('background' in manifest, false, `${target}: background execution is not part of v1.0.x`);
  assert.equal('content_scripts' in manifest, false, `${target}: content scripts are not part of v1.0.x`);
  assert.equal('externally_connectable' in manifest, false, `${target}: external connections are not part of v1.0.x`);

  const csp = manifest.content_security_policy?.extension_pages ?? '';
  assert.match(csp, /script-src\s+'self'/, `${target}: extension scripts must remain local`);
  assert.doesNotMatch(csp, /script-src[^;]*https?:\/\//i, `${target}: remote script origins are forbidden`);
}

test('source manifest preserves v1.0.x permission and architecture invariants', () => {
  assert.equal(sourceManifest.version, packageJson.version);
  assertCoreManifest(sourceManifest, 'source');
  assert.equal('browser_specific_settings' in sourceManifest, false);
});

for (const target of ['chromium', 'firefox']) {
  test(`${target} build contains required release files`, async () => {
    const targetDir = resolve(dist, target);
    assert.equal(await exists(targetDir), true, `Missing build directory: dist/${target}`);

    for (const file of REQUIRED_FILES) {
      assert.equal(
        await exists(resolve(targetDir, file)),
        true,
        `${target}: missing required release file ${file}`
      );
    }
  });

  test(`${target} manifest preserves release invariants`, async () => {
    const manifest = JSON.parse(await readFile(resolve(dist, target, 'manifest.json'), 'utf8'));
    assertCoreManifest(manifest, target);

    if (target === 'chromium') {
      assert.equal(
        'browser_specific_settings' in manifest,
        false,
        'chromium: Firefox-specific metadata must not be present'
      );
    } else {
      assert.equal(manifest.browser_specific_settings?.gecko?.id, 'btc-live@jsm.local');
      assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');
      assert.deepEqual(
        manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required,
        ['none']
      );
    }
  });

  test(`${target} build contains no remote executable code patterns`, async () => {
    const targetDir = resolve(dist, target);
    const files = await walk(targetDir);
    const textFiles = files.filter((file) => ['.js', '.html'].includes(extname(file)));

    const forbidden = [
      { name: 'eval()', pattern: /\beval\s*\(/ },
      { name: 'Function constructor', pattern: /\bnew\s+Function\s*\(/ },
      { name: 'remote script tag', pattern: /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i },
      { name: 'remote dynamic import', pattern: /\bimport\s*\(\s*["']https?:\/\//i }
    ];

    for (const file of textFiles) {
      const content = await readFile(file, 'utf8');
      const displayPath = relative(targetDir, file).split(sep).join('/');
      for (const rule of forbidden) {
        assert.doesNotMatch(
          content,
          rule.pattern,
          `${target}: ${rule.name} found in ${displayPath}`
        );
      }
    }
  });
}
