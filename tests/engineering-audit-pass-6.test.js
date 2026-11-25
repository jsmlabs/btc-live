import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAlertHistory, clearAlertHistory, ALERT_HISTORY_STORAGE_KEY } from '../storage/alert-history.js';
import { loadAlertTargets, addAlertTarget, ALERT_TARGETS_STORAGE_KEY } from '../storage/alert-targets.js';
import { SETTINGS_STORAGE_KEY } from '../storage/settings.js';
import { createReplaySessionStore } from '../storage/replay-sessions.js';

function deferred() { let resolve; const promise = new Promise(r => {resolve=r;}); return {promise,resolve}; }
function fakeLocks() {
  const tails = new Map();
  return {request(name,fn) {
    const task=(tails.get(name)??Promise.resolve()).then(fn);
    tails.set(name,task.catch(()=>{}));return task;
  }};
}
function globals(values) {
  const restore=[];
  for(const [key,value] of Object.entries(values)) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    restore.push(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
  }
  return ()=>restore.reverse().forEach(fn=>fn());
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('AUD-21: clearing history serializes behind a pending append', async()=>{
  const entered=deferred(),release=deferred();
  let rows=[{id:'old',at:1,type:'target',status:'sent'}];
  const storage={async get(){const result=rows.slice();entered.resolve();await release.promise;return {[ALERT_HISTORY_STORAGE_KEY]:result};},
    async set(value){rows=value[ALERT_HISTORY_STORAGE_KEY];}};
  const restore=globals({browser:{storage:{local:storage}},navigator:{locks:fakeLocks()}});
  try {
    const append=appendAlertHistory({id:'new',at:2,type:'target',status:'sent'});
    await entered.promise;
    const clear=clearAlertHistory();await flush();release.resolve();
    await Promise.all([append,clear]);
    assert.deepEqual(rows,[]);
  } finally {release.resolve();restore();}
});
test('AUD-22: migration cannot overwrite a concurrently created target',async()=>{
  let stored={},reads=0;
  const entered=deferred(),release=deferred();
  const storage={async get(key){
    if(key===SETTINGS_STORAGE_KEY){if(++reads===1){entered.resolve();await release.promise;}return {[key]:{notifyPriceAbove:true,priceAboveTarget:110000}};}
    return {...stored};
  },async set(value){stored={...stored,...value};}};
  const restore=globals({browser:{storage:{local:storage}},navigator:{locks:fakeLocks()}});
  try {
    const initial=loadAlertTargets();await entered.promise;
    const add=addAlertTarget({direction:'below',price:90000});await flush();
    release.resolve();await Promise.all([initial,add]);
    assert.equal(stored[ALERT_TARGETS_STORAGE_KEY].length,2);
    assert.ok(stored[ALERT_TARGETS_STORAGE_KEY].some(x=>x.price===90000));
  } finally {release.resolve();restore();}
});
test('AUD-23: a blocked IndexedDB open closes its eventual orphan connection',async()=>{
  const request={};let closed=0;
  const restore=globals({indexedDB:{open(){return request;}}});
  const store=createReplaySessionStore();
  try{
    const listing=store.list();
    request.onblocked();
    await assert.rejects(listing,/upgrade blocked/);
    request.result={close(){closed++;}};
    request.onsuccess();
    assert.equal(closed,1);
  }finally{store.close();restore();}
});
