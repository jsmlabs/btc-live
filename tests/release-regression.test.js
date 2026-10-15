import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
test('Manifest V3 permissions preserve least-privilege baseline',()=>{
 assert.equal(manifest.manifest_version,3);
 assert.deepEqual(manifest.permissions,['storage','notifications','alarms']);
 assert.deepEqual(manifest.host_permissions,['https://fapi.binance.com/*','https://api.github.com/*']);
});
test('Background and popup entrypoints stay stable',()=>{
 assert.equal(manifest.background.service_worker,'background/service-worker.js');
 assert.equal(manifest.background.type,'module');
 assert.equal(manifest.action.default_popup,'popup/popup.html');
});
test('Extension CSP rejects inline and eval scripts',()=>{
 const csp=manifest.content_security_policy.extension_pages;
 assert.match(csp,/script-src 'self'/);
 assert.doesNotMatch(csp,/unsafe-eval|unsafe-inline/);
});

test('private build package identity and version match the extension manifest', async () => {
 const pkg = JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 assert.equal(pkg.name,'btc-live');
 assert.equal(pkg.private,true);
 assert.equal(pkg.version,manifest.version);
});
