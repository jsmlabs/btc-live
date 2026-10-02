import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');
const chromium = resolve(dist, 'chromium');
const firefox = resolve(dist, 'firefox');

const base = JSON.parse(await readFile(resolve(src, 'manifest.base.json'), 'utf8'));

await rm(dist, { recursive: true, force: true });
await mkdir(chromium, { recursive: true });
await mkdir(firefox, { recursive: true });

const copySource = async (target) => {
  for (const directory of ['popup', 'market', 'ui', 'storage', 'utils', 'icons']) {
    await cp(resolve(src, directory), resolve(target, directory), { recursive: true });
  }
};

await Promise.all([copySource(chromium), copySource(firefox)]);

const chromiumManifest = structuredClone(base);
const firefoxManifest = structuredClone(base);
firefoxManifest.browser_specific_settings = {
  gecko: {
    id: 'btc-live@jsm.local',
    strict_min_version: '128.0',
    data_collection_permissions: {
      required: ['none']
    }
  }
};

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
await writeFile(resolve(chromium, 'manifest.json'), stableJson(chromiumManifest));
await writeFile(resolve(firefox, 'manifest.json'), stableJson(firefoxManifest));
