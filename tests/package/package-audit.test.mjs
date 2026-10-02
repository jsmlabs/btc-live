import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

const FORBIDDEN_PATH_PARTS = new Set([
  '.git',
  '.github',
  'node_modules',
  'tests',
  'scripts',
  'store-assets'
]);

const FORBIDDEN_FILENAMES = new Set([
  'README.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'PRIVACY.md',
  'LICENSE',
  'package.json',
  'package-lock.json'
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
  }

  return files;
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('ZIP end-of-central-directory record not found');
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  assert.equal(
    centralOffset + centralSize,
    eocdOffset,
    'ZIP central directory has an unexpected layout'
  );

  const entries = [];
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(
      buffer.readUInt32LE(offset),
      0x02014b50,
      `Invalid ZIP central-directory signature at entry ${index}`
    );

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;

    entries.push(buffer.subarray(fileNameStart, fileNameEnd).toString('utf8'));
    offset = fileNameEnd + extraLength + commentLength;
  }

  assert.equal(offset, centralOffset + centralSize, 'ZIP central directory length mismatch');
  return entries;
}

function assertSafeEntry(entry, target) {
  assert.ok(entry.length > 0, `${target}: empty ZIP entry`);
  assert.equal(entry.includes('\\'), false, `${target}: backslash path found: ${entry}`);
  assert.equal(entry.startsWith('/'), false, `${target}: absolute path found: ${entry}`);
  assert.equal(/^[A-Za-z]:\//.test(entry), false, `${target}: drive path found: ${entry}`);

  const parts = entry.split('/');
  assert.equal(parts.includes('..'), false, `${target}: path traversal found: ${entry}`);
  assert.equal(parts.includes('.'), false, `${target}: dot path component found: ${entry}`);

  for (const part of parts) {
    assert.equal(
      FORBIDDEN_PATH_PARTS.has(part),
      false,
      `${target}: forbidden directory packaged: ${entry}`
    );
  }

  assert.equal(
    FORBIDDEN_FILENAMES.has(parts.at(-1)),
    false,
    `${target}: forbidden repository file packaged: ${entry}`
  );
}

for (const target of ['chromium', 'firefox']) {
  test(`${target} ZIP is versioned and exactly matches its build output`, async () => {
    const zipName = `btc-live-${target}-v${packageJson.version}.zip`;
    const zipPath = resolve(root, zipName);
    const archive = await readFile(zipPath);
    const entries = readZipEntries(archive);

    assert.ok(entries.length > 0, `${target}: package is empty`);
    assert.equal(new Set(entries).size, entries.length, `${target}: duplicate ZIP entries found`);

    for (const entry of entries) assertSafeEntry(entry, target);

    const buildFiles = await listFiles(resolve(dist, target));
    const expected = buildFiles
      .map((file) => normalizePath(relative(resolve(dist, target), file)))
      .sort();
    const actual = [...entries].sort();

    assert.deepEqual(
      actual,
      expected,
      `${target}: ZIP contents differ from verified dist/${target} output`
    );

    assert.ok(actual.includes('manifest.json'), `${target}: manifest.json missing from package root`);
    assert.ok(actual.includes('popup/popup.html'), `${target}: popup entry missing from package`);
  });

  test(`${target} ZIP contains no nested release archive`, async () => {
    const zipPath = resolve(root, `btc-live-${target}-v${packageJson.version}.zip`);
    const entries = readZipEntries(await readFile(zipPath));

    for (const entry of entries) {
      assert.equal(
        entry.toLowerCase().endsWith('.zip'),
        false,
        `${target}: nested ZIP found: ${entry}`
      );
    }
  });
}
