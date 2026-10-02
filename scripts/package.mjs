import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

function u16(value) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value);
  return b;
}

function u32(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value >>> 0);
  return b;
}

async function createZip(inputDir, outputFile) {
  const files = await listFiles(inputDir);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = relative(inputDir, file).split(sep).join('/');
    const nameBytes = Buffer.from(name);
    const content = await readFile(file);
    const compressed = deflateRawSync(content, { level: 9 });
    const crc = crc32(content);
    const method = 8;
    const dosTime = 0;
    const dosDate = 33; // 1980-01-01, deterministic ZIP timestamp.

    const localHeader = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(method), u16(dosTime), u16(dosDate),
      u32(crc), u32(compressed.length), u32(content.length), u16(nameBytes.length), u16(0), nameBytes
    ]);
    locals.push(localHeader, compressed);

    const centralHeader = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(method), u16(dosTime), u16(dosDate),
      u32(crc), u32(compressed.length), u32(content.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes
    ]);
    centrals.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDirectory.length), u32(offset), u16(0)
  ]);
  await writeFile(outputFile, Buffer.concat([...locals, centralDirectory, end]));
}

for (const target of ['chromium', 'firefox']) {
  const input = resolve(root, 'dist', target);
  const output = resolve(root, `btc-live-${target}-v${version}.zip`);
  const info = await stat(input).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`Missing build directory: ${input}. Run npm run build first.`);
  await createZip(input, output);
  process.stdout.write(`Created ${basename(output)}\n`);
}
