import {execFileSync} from 'node:child_process';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,[path.join(root,'scripts/verify.mjs')],{stdio:'inherit'});
console.log('Verification passed. Package the extension root excluding tests/, scripts/, docs/, package.json and README.md.');
