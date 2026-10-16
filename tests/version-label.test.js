import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveExtensionVersion, displayExtensionVersion } from '../ui/version-label.js';

test('installed manifest is authoritative, not a hardcoded footer', () => {
  assert.equal(resolveExtensionVersion({runtime:{getManifest:()=>({version:'1.25.8'})}}),'1.25.8');
  assert.equal(resolveExtensionVersion({runtime:{getManifest:()=>({version:'invalid'})}}),null);
  assert.equal(resolveExtensionVersion({runtime:{getManifest:()=>{throw Error('not available');}}}),null);
  assert.equal(resolveExtensionVersion(null),null);
});
test('footer renders installed version with safe textContent', () => {
  const labels = [{textContent:''}, {textContent:''}];
  displayExtensionVersion({querySelectorAll:()=>labels},{runtime:{getManifest:()=>({version:'1.25.8'})}});
  assert.deepEqual(labels.map(label=>label.textContent), ['BTC LIVE · V1.25.8','BTC LIVE · V1.25.8']);
  displayExtensionVersion({querySelectorAll:()=>labels},null);
  assert.equal(labels[0].textContent,'BTC LIVE · Version unavailable');
});
test('both surfaces bind the installed version and contain no hardcoded footer', async () => {
  for (const surface of ['popup','dashboard']) {
    const html = await readFile(new URL(`../${surface}/${surface}.html`,import.meta.url),'utf8');
    const js = await readFile(new URL(`../${surface}/${surface}.js`,import.meta.url),'utf8');
    assert.match(html,/data-extension-version/);
    assert.doesNotMatch(html,/BTC LIVE · V\d+\.\d+\.\d+/);
    assert.match(js,/displayExtensionVersion\(document, api\)/);
  }
});
