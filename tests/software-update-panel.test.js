import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSoftwareUpdates } from '../ui/software-update-panel.js';

function fakeElement(tag) {
  const listeners = new Map();
  return {
    tag, children: [], hidden: false, disabled: false, textContent: '', value: '',
    attributes: new Map(),
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); delete this[name]; },
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { listeners.delete(name); },
    remove() { this.removed = true; },
    fire(name) { listeners.get(name)?.(); }
  };
}

test('software update panel validates storage events and never exposes an untrusted release URL', async t => {
  const previous = globalThis.document;
  globalThis.document = { createElement: fakeElement };
  t.after(() => { globalThis.document = previous; });
  let listener;
  const now = Date.now();
  const stored = {enabled:true,channel:'stable',checkedInstalled:'1.24.1',
    status:'UNSUPPORTED',lastSuccessAt:now,lastAttemptAt:now,release:null};
  const api = {
    runtime: { getManifest:()=>({version:'1.24.1'}),
      sendMessage:async()=>({ok:true,state:stored}) },
    storage: { onChanged: {
      addListener(fn) { listener = fn; },
      removeListener(fn) { if (listener === fn) listener = null; }
    } }
  };
  const container = fakeElement('div');
  const indicator = fakeElement('button');
  const dispose = mountSoftwareUpdates({container, indicator, api});
  await new Promise(resolve => setImmediate(resolve));
  const [title, status, detail, note, toggleLabel, channelLabel, controls] = container.children[0].children;
  const [button, link, sourceLink] = controls.children;
  assert.equal(sourceLink.hidden, false);
  assert.equal(sourceLink.href, 'https://github.com/jsmlabs/btc-live#get-started');
  assert.equal(sourceLink.target, '_blank');
  assert.equal(title.textContent, 'Software Updates');
  assert.equal(status.textContent, 'No eligible published release is available');
  assert.equal(note.hidden,false);
  assert.equal(button.disabled,false);
  assert.match(detail.textContent,/Last successful check/);
  assert.match(detail.textContent,/Last attempt/);

  const tampered = {...stored,status:'UPDATE_AVAILABLE',
    release:{version:'1.25.0',prerelease:false,url:'javascript:alert(1)'}};
  listener({btcLiveSoftwareUpdates:{newValue:tampered}},'local');
  assert.equal(link.hidden,true);
  assert.equal(link.href,undefined);
  assert.equal(indicator.hidden,true);
  assert.equal(status.textContent,'Not checked yet');

  const valid={...tampered,release:{...tampered.release,
    url:'https://github.com/jsmlabs/btc-live/releases/tag/v1.25.0'}};
  listener({btcLiveSoftwareUpdates:{newValue:valid}},'local');
  assert.equal(link.hidden,false);
  assert.equal(sourceLink.hidden,true);
  assert.equal(link.href,valid.release.url);
  assert.equal(indicator.hidden,false);

  listener({btcLiveSoftwareUpdates:{newValue:{...valid,checkedInstalled:'1.22.0'}}},'local');
  assert.equal(link.hidden,true);
  assert.equal(indicator.hidden,true);
  dispose();
  assert.equal(listener,null);
  assert.equal(container.children[0].removed,true);
});
