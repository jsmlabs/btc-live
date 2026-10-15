import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documents = [];
const files = new Set();
const ignored = new Set(['.git', 'node_modules', 'dist', 'release']);

async function index(directory = '') {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const relative = path.posix.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Documentation symlink: ' + relative);
    if (entry.isDirectory()) await index(relative);
    else if (entry.isFile()) {
      files.add(relative);
      if (relative.endsWith('.md') && (!relative.includes('/') || relative.startsWith('docs/'))) documents.push(relative);
    }
  }
}
await index();

const failures = [];
for (const doc of documents.sort()) {
  const source = await readFile(path.join(root, doc), 'utf8');
  const cleaned = source.replace(/```[\s\S]*?```/g, '');
  const urls = [
    ...[...cleaned.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1]),
    ...[...cleaned.matchAll(/<(?:a|img)\b[^>]*\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1])
  ];
  for (const raw of urls) {
    const destination = raw.trim().replace(/^<|>$/g, '');
    if (!destination || /^(?:https?:|mailto:|#|data:)/i.test(destination)) continue;
    let target;
    try { target = decodeURIComponent(destination.split(/[?#]/)[0]); }
    catch { failures.push(`${doc}: invalid URL encoding ${destination}`); continue; }
    if (!target || target.startsWith('/')) {
      failures.push(`${doc}: unsafe local link ${destination}`);
      continue;
    }
    const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(doc), target));
    if (normalized.startsWith('../') || normalized === '..' || !files.has(normalized)) {
      failures.push(`${doc}: missing or unsafe local link ${destination}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentation links passed: ${documents.length} Markdown files checked.`);
}
