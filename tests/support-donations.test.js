import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SUPPORT_ADDRESS, mountSupportDialog } from '../ui/support-donations.js';

const text = async file => readFile(new URL('../' + file, import.meta.url), 'utf8');

function harness(clipboard) {
  const registry = new Map();
  function element(id) {
    const events = new Map();
    return {
      id, events, open: false, disabled: false, textContent: '', value: id === 'supportAddress' ? SUPPORT_ADDRESS : '',
      isConnected: true, focused: false, selected: false,
      addEventListener(type, callback) { events.set(type, callback); },
      removeEventListener(type, callback) { if (events.get(type) === callback) events.delete(type); },
      focus() { this.focused = true; },
      select() { this.selected = true; },
      showModal() { this.open = true; },
      close() { this.open = false; this.emit('close'); },
      emit(type, fields = {}) { return events.get(type)?.({ currentTarget: this, stopPropagation() {}, ...fields }); }
    };
  }
  for (const id of ['supportDialog','supportAddress','supportCopy','supportCopyFeedback','supportClose','supportDone','trigger1','trigger2']) registry.set(id, element(id));
  const doc = {
    getElementById(id) { return registry.get(id); },
    querySelectorAll() { return [registry.get('trigger1'), registry.get('trigger2')]; }
  };
  const dispose = mountSupportDialog({ doc, clipboard });
  return { get: id => registry.get(id), dispose };
}

test('voluntary support appears in both surfaces without new permissions', async () => {
  for (const file of ['popup/popup.html','dashboard/dashboard.html']) {
    const html = await text(file);
    for (const id of ['supportDialog','supportAddress','supportCopy','supportCopyFeedback','supportClose','supportDone']) {
      assert.match(html, new RegExp('id="' + id + '"'));
    }
    assert.match(html, /data-support-open/);
    assert.match(html, /href="\.\.\/ui\/support-donations\.css"/);
    assert.match(html, /src="\.\.\/ui\/usdc-solana-qr\.png"/);
    assert.ok(html.includes('>' + SUPPORT_ADDRESS + '</textarea>'));
    assert.match(html, /entirely optional donation/);
    assert.match(html, /USDC on the Solana network/);
    assert.match(html, /Binance deposit address/);
  }
  assert.match(await text('popup/popup.js'), /mountSupportDialog\(\)/);
  assert.match(await text('dashboard/dashboard.js'), /mountSupportDialog\(\)/);
  const manifest = JSON.parse(await text('manifest.json'));
  assert.deepEqual(manifest.permissions, ['storage','notifications','alarms']);
  assert.deepEqual(manifest.host_permissions, ['https://fapi.binance.com/*','https://api.github.com/*']);
});

test('bundled QR is byte-identical to the locally verified Notely source', async () => {
  const bytes = await readFile(new URL('../ui/usdc-solana-qr.png', import.meta.url));
  assert.deepEqual([...bytes.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  const hash = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(hash, 'b79ebd30d825e5578df56b64340db9c0f436a8ce');
});

test('support dialog opens, copies address, closes and restores focus', async () => {
  const app = harness({ writeText: async value => assert.equal(value, SUPPORT_ADDRESS) });
  app.get('trigger1').emit('click');
  assert.equal(app.get('supportDialog').open, true);
  assert.equal(app.get('supportCopy').focused, true);
  await app.get('supportCopy').emit('click');
  assert.equal(app.get('supportCopy').textContent, 'Copied');
  assert.equal(app.get('supportCopy').disabled, false);
  app.get('supportDone').emit('click');
  assert.equal(app.get('supportDialog').open, false);
  assert.equal(app.get('trigger1').focused, true);
  app.get('trigger2').emit('click');
  assert.equal(app.get('supportCopy').textContent, 'Copy address');
  app.get('supportClose').emit('click');
  assert.equal(app.get('trigger2').focused, true);
  app.dispose();
  assert.equal(app.get('trigger1').events.size, 0);
  assert.equal(app.get('supportDialog').events.size, 0);
});

test('copy rejection selects the full address for manual copying', async () => {
  const app = harness({ writeText: async () => { throw Error('Denied'); } });
  app.get('trigger1').emit('click');
  await app.get('supportCopy').emit('click');
  assert.equal(app.get('supportAddress').selected, true);
  assert.match(app.get('supportCopyFeedback').textContent, /copy the address manually/i);
  assert.equal(app.get('supportCopy').disabled, false);
  app.dispose();
});

test('late clipboard completion cannot update a reopened support dialog', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const app = harness({ writeText: () => pending });
  app.get('trigger1').emit('click');
  const request = app.get('supportCopy').emit('click');
  app.get('supportClose').emit('click');
  app.get('trigger1').emit('click');
  resolve();
  await request;
  assert.equal(app.get('supportDialog').open, true);
  assert.equal(app.get('supportCopy').textContent, 'Copy address');
  assert.equal(app.get('supportCopyFeedback').textContent, '');
  assert.equal(app.get('supportCopy').disabled, false);
  app.dispose();
});
