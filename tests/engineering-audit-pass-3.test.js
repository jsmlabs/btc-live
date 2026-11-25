import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTradeEvent, normalizeRestTicker } from '../market/validators.js';
import { mountSoftwareUpdates } from '../ui/software-update-panel.js';
import { assertReleaseTreeClean } from '../scripts/release-gate.mjs';

const NOW = 1800000000000;
test('AUD-11: market numbers never coerce booleans, arrays or blank strings', () => {
  const trade = {e:'aggTrade',s:'BTCUSDT',p:'100',a:42,T:NOW};
  assert.equal(normalizeTradeEvent(trade,NOW).lastTradeId,42);
  for (const invalid of [true,false,[],[42],{},' ','\t']) {
    assert.equal(normalizeTradeEvent({...trade,a:invalid},NOW),null);
    assert.equal(normalizeTradeEvent({...trade,p:invalid},NOW),null);
  }
  const ticker = {symbol:'BTCUSDT',lastPrice:'100',openPrice:'100',highPrice:'101',lowPrice:'99',priceChange:'0',priceChangePercent:'0',volume:'0',quoteVolume:'0',closeTime:NOW,lastId:42};
  assert.equal(normalizeRestTicker(ticker,NOW).baseVolume24h,0);
  for (const invalid of [false,[],[0],' ']) {
    assert.equal(normalizeRestTicker({...ticker,volume:invalid},NOW),null);
  }
});

function element() {
  return {children:[],hidden:false,append(...nodes){this.children.push(...nodes);},setAttribute(){},removeAttribute(k){delete this[k];},addEventListener(){},remove(){}};
}
test('AUD-12: deleted update cache immediately clears stale links and indicator', async () => {
  const previous = globalThis.document;
  globalThis.document = {createElement:element};
  let listener;
  const version='1.25.8', stamp=Date.now();
  const state={checkedInstalled:version,lastSuccessAt:stamp,channel:'stable',
    release:{version:'1.26.0',prerelease:false,url:'https://github.com/jsmlabs/btc-live/releases/tag/v1.26.0',
      downloadUrl:'https://github.com/jsmlabs/btc-live/releases/download/v1.26.0/btc-live-chromium-v1.26.0-candidate.zip'}};
  const api={runtime:{getManifest:()=>({version}),sendMessage:async()=>({ok:true,state})},
    storage:{onChanged:{addListener(fn){listener=fn;},removeListener(){}}}};
  const container=element(), indicator=element();
  const dispose=mountSoftwareUpdates({container,indicator,api});
  try {
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const [,, , ,controls,advanced]=container.children[0].children;
    const link=controls.children[1], download=advanced.children[3];
    listener({btcLiveSoftwareUpdates:{newValue:state}},'local');
    assert.equal(link.hidden,false); assert.equal(download.hidden,false); assert.equal(indicator.hidden,false);
    listener({btcLiveSoftwareUpdates:{oldValue:state}},'local');
    assert.equal(link.hidden,true); assert.equal(link.href,undefined);
    assert.equal(download.hidden,true); assert.equal(download.href,undefined); assert.equal(indicator.hidden,true);
    assert.equal(container.children[0].children[1].textContent,'Not checked yet');
  } finally {dispose();globalThis.document=previous;}
});

test('AUD-13: release gate rejects tracked changes and untracked or ignored runtime files', () => {
  const checked=[];
  const mock=(status,extras)=>(command,args,opts)=>{
    assert.equal(command,'git'); assert.equal(opts.cwd,'/repo');
    checked.push(args);
    return args[0]==='status'?status:extras;
  };
  assert.doesNotThrow(()=>assertReleaseTreeClean('/repo',mock('','')));
  assert.throws(()=>assertReleaseTreeClean('/repo',mock(' M app/runtime.js','')),/tracked changes/);
  assert.throws(()=>assertReleaseTreeClean('/repo',mock('','app/local.js\0')),/untracked runtime/);
  assert.throws(()=>assertReleaseTreeClean('/repo',mock('','app/ignored.log\0')),/untracked runtime/);
  const args=checked.find(x=>x[0]==='ls-files');
  assert.ok(args.includes('--others')&&args.includes('-z')&&!args.includes('--exclude-standard'));
  assert.ok(args.includes('app')&&args.includes('manifest.json')&&!args.includes('dist'));
});
