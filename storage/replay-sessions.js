import { EVENT_MAX_BYTES, parseEventRecording } from '../ui/event-recorder.js';

/** Explicitly saved, local-only, versioned replay sessions. Never a live feed or alert source. */
export const SESSION_DB_NAME = 'btc-live-replay-sessions-v1';
export const SESSION_LIMIT = 12;
export const SESSION_TOTAL_BYTES = 24 * 1024 * 1024;
export const SESSION_CHUNK_BYTES = 64 * 1024;
export const SESSION_FORMAT = 'btc-live-session/v1';
const STORE = 'sessions';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const validId = (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v);
const validName = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64 && !/[\u0000-\u001f\u007f]/.test(v);
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const digest = async (bytes) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));

async function inflateBounded(bytes) {
  if (typeof DecompressionStream !== 'function') throw new Error('Gzip replay decoding is unsupported in this browser');
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const pieces = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > EVENT_MAX_BYTES) throw new Error('Decompressed replay exceeds 4 MiB');
      pieces.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const result = new Uint8Array(length);
  let position = 0;
  for (const piece of pieces) { result.set(piece, position); position += piece.byteLength; }
  return result;
}

export async function encodeSession(text, name = 'Futures event capture', createdAt = Date.now()) {
  parseEventRecording(text);
  if (!validName(name) || !Number.isSafeInteger(createdAt) || createdAt <= 0) throw new Error('Invalid session metadata');
  const raw = encoder.encode(text);
  if (raw.byteLength > EVENT_MAX_BYTES) throw new Error('Replay exceeds 4 MiB');
  let payload = raw, codec = 'identity';
  if (typeof CompressionStream === 'function') {
    const zipped = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    if (zipped.byteLength < raw.byteLength) { payload = zipped; codec = 'gzip'; }
  }
  const chunks = [];
  for (let offset = 0; offset < payload.length; offset += SESSION_CHUNK_BYTES) chunks.push(payload.slice(offset, offset + SESSION_CHUNK_BYTES));
  return { format: SESSION_FORMAT, id: crypto.randomUUID(), name, createdAt, codec,
    rawBytes: raw.byteLength, storedBytes: payload.byteLength, sha256: await digest(raw), chunks };
}

export async function decodeSession(entry) {
  if (!entry || entry.format !== SESSION_FORMAT || !validId(entry.id) || !validName(entry.name) ||
      !Number.isSafeInteger(entry.createdAt) || entry.createdAt <= 0 || !['gzip', 'identity'].includes(entry.codec) ||
      !Number.isSafeInteger(entry.rawBytes) || entry.rawBytes <= 0 || entry.rawBytes > EVENT_MAX_BYTES ||
      !Number.isSafeInteger(entry.storedBytes) || entry.storedBytes <= 0 || entry.storedBytes > EVENT_MAX_BYTES ||
      !/^[0-9a-f]{64}$/.test(entry.sha256) || !Array.isArray(entry.chunks) || !entry.chunks.length || entry.chunks.length > 65)
    throw new Error('Invalid saved replay envelope');
  const compressed = new Uint8Array(entry.storedBytes);
  let offset = 0;
  for (const part of entry.chunks) {
    if (!(part instanceof Uint8Array) || part.byteLength < 1 || part.byteLength > SESSION_CHUNK_BYTES || offset + part.byteLength > compressed.length)
      throw new Error('Invalid replay chunk');
    compressed.set(part, offset);
    offset += part.byteLength;
  }
  if (offset !== compressed.length) throw new Error('Incomplete replay chunks');
  const raw = entry.codec === 'gzip' ? await inflateBounded(compressed) : compressed;
  if (raw.byteLength !== entry.rawBytes || await digest(raw) !== entry.sha256) throw new Error('Replay integrity check failed');
  const text = decoder.decode(raw);
  parseEventRecording(text);
  return text;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}
async function openDatabase() {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable; sessions remain in memory');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SESSION_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open replay database'));
    request.onblocked = () => reject(new Error('Replay database upgrade blocked by another tab'));
  });
}
const metadata = (e) => ({ id: e.id, name: e.name, createdAt: e.createdAt, rawBytes: e.rawBytes, storedBytes: e.storedBytes, codec: e.codec });

export function createReplaySessionStore() {
  let dbPromise = null;
  const open = () => (dbPromise ??= openDatabase().catch((error) => { dbPromise = null; throw error; }));
  async function list() {
    const db = await open(); const tx = db.transaction(STORE, 'readonly'); const done = transactionDone(tx);
    const records = await requestResult(tx.objectStore(STORE).getAll()); await done;
    return records.map(metadata).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  }
  async function save(text, name = 'Futures event capture') {
    const record = await encodeSession(text, name);
    const db = await open(); const tx = db.transaction(STORE, 'readwrite'); const done = transactionDone(tx);
    try {
      const store = tx.objectStore(STORE);
      const existing = await requestResult(store.getAll());
      if (existing.length >= SESSION_LIMIT || existing.reduce((sum, e) => sum + e.storedBytes, 0) + record.storedBytes > SESSION_TOTAL_BYTES)
        throw new Error('Replay storage limit reached; delete a saved session first');
      store.put(record);
      await done;
      return metadata(record);
    } catch (error) { try { tx.abort(); } catch {} await done.catch(() => {}); throw error; }
  }
  async function load(id) {
    if (!validId(id)) throw new Error('Invalid replay session ID');
    const db = await open(); const tx = db.transaction(STORE, 'readonly'); const done = transactionDone(tx);
    const entry = await requestResult(tx.objectStore(STORE).get(id)); await done;
    if (!entry) throw new Error('Saved session not found');
    return { metadata: metadata(entry), text: await decodeSession(entry) };
  }
  async function remove(id) {
    if (!validId(id)) throw new Error('Invalid replay session ID');
    const db = await open(); const tx = db.transaction(STORE, 'readwrite'); const done = transactionDone(tx);
    tx.objectStore(STORE).delete(id); await done;
  }
  function close() { if (dbPromise) void dbPromise.then((db) => db.close()).catch(() => {}); dbPromise = null; }
  return { list, save, load, remove, close };
}
