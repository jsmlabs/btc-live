import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderScheduler} from '../ui/render-scheduler.js';
import {sanitizeAdvancedState} from '../storage/advanced-alert-rules.js';
import {parseRecording,REPLAY_MAX_BYTES} from '../ui/market-recorder.js';
import {parseEventRecording,EVENT_MAX_BYTES} from '../ui/event-recorder.js';

test('render scheduler coalesces updates and exposes bounded numeric metrics',()=>{
  const queue=new Map();let id=0,now=0,draws=0;
  const r=createRenderScheduler(()=>{draws++;now+=3},{requestFrame:fn=>{queue.set(++id,fn);return id},cancelFrame:key=>queue.delete(key),clock:()=>now});
  r.schedule();r.schedule();r.schedule();
  assert.equal(queue.size,1);assert.equal(r.diagnostics().coalesced,2);
  const next=queue.values().next().value;queue.clear();next();
  assert.equal(draws,1);assert.equal(r.diagnostics().maxRenderMs,3);
  assert.equal(r.diagnostics().frames,1);r.dispose();r.schedule();assert.equal(queue.size,0);
});
test('scheduler records throwing renders without fabricating successful runs',()=>{
  let fn;const r=createRenderScheduler(()=>{throw Error('render failed')},{requestFrame:cb=>{fn=cb;return 1},cancelFrame:()=>{},clock:()=>5});
  r.schedule();assert.throws(()=>fn(),/render failed/);assert.equal(r.diagnostics().errors,1);assert.equal(r.diagnostics().frames,1);
});
test('advanced state import rejects invalid entries and bounds hostile objects',()=>{
  const state=sanitizeAdvancedState({safe:{armed:false,lastSentAt:100},bad:{armed:'false',lastSentAt:0},negative:{armed:true,lastSentAt:-1},'../escape':{armed:true,lastSentAt:null}});
  assert.deepEqual(Object.keys(state),['safe']);assert.equal(state.safe.lastSentAt,100);
  assert.deepEqual(Object.keys(sanitizeAdvancedState(null)),[]);
});
test('offline replay imports reject oversized payloads before JSON parsing',()=>{
  assert.throws(()=>parseRecording('x'.repeat(REPLAY_MAX_BYTES+1)),/size limit/);
  assert.throws(()=>parseEventRecording('x'.repeat(EVENT_MAX_BYTES+1)),/limit/);
});
