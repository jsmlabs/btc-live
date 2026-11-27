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

test('manual release workflow remains approval-gated and never runs on push', async () => {
 const workflow = await readFile(path.join(root,'.github/workflows/publish-approved-release.yml'),'utf8');
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^  push:/m);
 assert.doesNotMatch(workflow,/^  pull_request:/m);
 assert.match(workflow,/environment: production-release/);
 assert.match(workflow,/secrets\.RELEASE_ACCEPTANCE_JSON/);
 assert.match(workflow,/RELEASE_ACCEPTANCE_FILE=dist\/release-approval\.json npm run release:gate/);
 assert.match(workflow,/--target "\$GITHUB_SHA"/);
 assert.match(workflow,/gh release create/);
});

test('experimental preview publication cannot become a stable release or run automatically', async () => {
 const workflow = await readFile(path.join(root,'.github/workflows/publish-experimental-preview.yml'),'utf8');
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^  push:/m);
 assert.doesNotMatch(workflow,/^  pull_request:/m);
 assert.match(workflow,/PUBLISH_UNTESTED_PREVIEW/);
 assert.match(workflow,/--prerelease/);
 assert.match(workflow,/EXPERIMENTAL.*UNTESTED/);
 assert.match(workflow,/--skip-verify/);
 assert.doesNotMatch(workflow,/release:gate/);
 const stable = await readFile(path.join(root,'.github/workflows/publish-approved-release.yml'),'utf8');
 assert.match(stable,/release:gate/);
 assert.match(stable,/environment: production-release/);
});

test('candidate version is consistent across the maintained public metadata', async () => {
 const acceptance=JSON.parse(await readFile(path.join(root,'docs/release-acceptance.json'),'utf8'));
 assert.equal(acceptance.manifest_version,manifest.version);
 const readme=await readFile(path.join(root,'README.md'),'utf8');
 assert.ok(readme.includes('manifest-'+manifest.version+'-'));
 assert.ok(readme.includes('btc-live-chromium-v'+manifest.version+'-candidate.zip'));
 for(const file of ['docs/ARCHITECTURE.md','docs/USAGE.md','docs/RELEASE.md']){
  const contents=await readFile(path.join(root,file),'utf8');
  assert.ok(contents.includes(String.fromCharCode(96)+manifest.version+String.fromCharCode(96)),file);
 }
 const workflow=await readFile(path.join(root,'.github/workflows/auto-semver.yml'),'utf8');
 assert.match(workflow,/ref: main\s+fetch-depth: 0/);
});
