import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const version = packageJson.version;

const targets = ['chromium', 'firefox'];

function archivePath(target) {
  return resolve(root, `btc-live-${target}-v${version}.zip`);
}

async function sha256(path) {
  const buffer = await readFile(path);
  return createHash('sha256').update(buffer).digest('hex');
}

function runScript(scriptName) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts', scriptName)], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${scriptName} failed with exit code ${result.status}`);
  }

  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
}

const first = {};
for (const target of targets) {
  first[target] = await sha256(archivePath(target));
}

runScript('build.mjs');
runScript('package.mjs');

const second = {};
for (const target of targets) {
  second[target] = await sha256(archivePath(target));
}

for (const target of targets) {
  assert.equal(
    second[target],
    first[target],
    `${target} package is not reproducible: ${first[target]} != ${second[target]}`
  );

  process.stdout.write(
    `${target}: reproducible SHA-256 ${second[target]}\n`
  );
}
