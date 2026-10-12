import assert from 'node:assert/strict';
import { copyFile, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeFiles } from './runtime-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const output = path.join(root, 'dist', `btc-live-chromium-v${manifest.version}-store`);
const staging = `${output}.tmp`;
const storeFiles = runtimeFiles;

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
