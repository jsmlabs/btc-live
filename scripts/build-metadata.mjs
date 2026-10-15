import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const candidates = (await readdir(out)).filter(name => /^btc-live-chromium-v[0-9]+\.[0-9]+\.[0-9]+-candidate\.zip$/.test(name));
if (candidates.length !== 1) throw Error('Expected exactly one candidate package in dist/');
const name = candidates[0];
if (name !== `btc-live-chromium-v${manifest.version}-candidate.zip`) throw Error('Package version mismatch');
const bytes = await readFile(path.join(out, name));
const digest = createHash('sha256').update(bytes).digest('hex');
let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
catch { if (process.env.GITHUB_SHA) commit = process.env.GITHUB_SHA; }
if (commit && !/^[0-9a-f]{40}$/.test(commit)) throw Error('Invalid commit identity');
if (commit && process.env.GITHUB_SHA && commit !== process.env.GITHUB_SHA) throw Error('Build commit mismatch');
const details = {
  schema_version: 1,
  product: 'BTC Live',
  release_status: 'development-candidate',
  manifest_version: manifest.version,
  commit,
  artifact: { name, sha256: digest, bytes: bytes.length },
  limitations: 'Automated verification only; browser, live-feed, lifecycle, migration, load and store acceptance pending'
};
await writeFile(path.join(out, 'BUILD_INFO.json'), JSON.stringify(details, null, 2) + '\n');
await writeFile(path.join(out, 'SHA256SUMS.txt'), `${digest}  ${name}\n`);
console.log(`Build metadata created for ${name}, SHA-256 ${digest}`);
