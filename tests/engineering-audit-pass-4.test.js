import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventRecorder, parseEventRecording } from '../ui/event-recorder.js';
import { replayEventRecording } from '../ui/event-replay.js';

const NOW = 1800000000000;
function fixture() {
  const r = createEventRecorder();
  r.start();
  assert.equal(r.append('depth.snapshot',{updateId:100,bids:[[99,2]],asks:[[101,3]]},NOW),true);
  const trade=(id,at)=>({id,segment:1,eventAt:at,tradeAt:at,price:100,quantity:1,side:'buy'});
  assert.equal(r.append('trade',trade(1,NOW+100),NOW+100),true);
  assert.equal(r.append('trade',trade(2,NOW+200),NOW+200),true);
  assert.equal(r.append('depth.diff',{firstId:101,finalId:101,prevId:100,eventAt:NOW+300,bids:[[99,4]],asks:[]},NOW+300),true);
  assert.equal(r.append('trade',trade(3,NOW+400),NOW+400),true);
  assert.equal(r.append('trade',trade(4,NOW+6300),NOW+6300),true);
  assert.equal(r.append('trade',trade(5,NOW+6301),NOW+6301),true);
  assert.equal(r.append('gap',{feed:'depth',status:'RECONNECTING'},NOW+6400),true);
  assert.equal(r.append('depth.snapshot',{updateId:200,bids:[[98,5]],asks:[[102,1]]},NOW+6500),true);
  r.stop();
  return r;
}
test('AUD-15: capture preserves sequence and rejects invalid diffs transactionally',()=>{
  const r=fixture();
  assert.equal(parseEventRecording(r.exportJson()).events.length,9);
  const snapshot=r.snapshot(); snapshot.events[0].bids[0][1]=999;
  assert.equal(parseEventRecording(r.exportJson()).events[0].bids[0][1],2);
  r.start();
  assert.equal(r.append('depth.snapshot',{updateId:100,bids:[[99,2]],asks:[[101,3]]},NOW),true);
  assert.equal(r.append('depth.diff',{firstId:101,finalId:101,prevId:100,eventAt:NOW+1,bids:[[102,1]],asks:[]},NOW+1),false);
  assert.equal(r.state().status,'INVALID');
  assert.equal(parseEventRecording(r.exportJson()).events.length,1);
});
test('AUD-16: replay preserves depth changes, exact freshness boundary and frame isolation',()=>{
  const frames=replayEventRecording(fixture().exportJson(),25);
  assert.deepEqual(frames.map(f=>f.bidNotional),[198,198,198,396,396,396,null,null,490]);
  assert.deepEqual(frames.map(f=>f.depthReady),[true,true,true,true,true,true,false,false,true]);
  assert.deepEqual(frames.map(f=>f.cvdBtc),[null,1,2,2,3,4,5,5,5]);
  assert.equal(frames[1].depthId,100); assert.equal(frames[4].depthId,101);
  assert.equal(frames[8].depthFrom,8);
  assert.deepEqual(frames[0].bands,frames[1].bands);
  frames[0].bands[0].notional=-1;
  assert.ok(frames[1].bands.every(b=>b.notional>0));
});
