import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documents = ['README.md', 'GITHUB_RELEASE.md'];
async function listDocs(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error('Documentation symlink: ' + entry.name);
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await listDocs(relative);
    else if (entry.isFile() && entry.name.endsWith('.md')) documents.push(relative);
  }
}
await listDocs('docs');
const files = new Set();
async function index(directory = '') {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue;
    const relative = path.posix.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await index(relative);
    else if (entry.isFile()) files.add(relative);
  }
}
await index();
const failures = [];
for (const doc of documents) {
  const source = await readFile(path.join(root, doc), 'utf8');
  const cleaned = source.replace(/```[\s\S]*?```/g, '');
  for (const match of cleaned.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const destination = match[1].trim().replace(/^<|>$/g, '');
    if (!destination || /^(?:https?:|mailto:|#)/i.test(destination)) continue;
    const target = decodeURIComponent(destination.split(/[?#]/)[0]);
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
