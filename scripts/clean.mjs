import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
await Promise.all([
  rm(resolve(root, 'dist'), { recursive: true, force: true }),
  rm(resolve(root, 'btc-live-chromium-v1.0.0.zip'), { force: true }),
  rm(resolve(root, 'btc-live-firefox-v1.0.0.zip'), { force: true })
]);
