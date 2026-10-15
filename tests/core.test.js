import test from 'node:test';
import assert from 'node:assert/strict';
import {sma,ema} from '../ui/chart-math.js';
import {reconnectDelay,RECONNECT_DELAYS_MS} from '../utils/backoff.js';
import {parseDepthEvent,parseDepthSnapshot,createLocalDepthBook} from '../market/binance-depth.js';
import {evaluateConfluence} from '../ui/confluence.js';

const snap = {lastUpdateId:100,bids:[['99','2']],asks:[['101','3']]};
const event = (U,u,pu,b=[['99','4']],a=[['101','3']]) => ({e:'depthUpdate',s:'BTCUSDT',U,u,pu,E:1000,b,a});

test('SMA and EMA respect warmup and deterministic values',()=>{
  const candles=[1,2,3,4].map(close=>({close}));
  assert.deepEqual(sma(candles,2),[null,1.5,2.5,3.5]);
  assert.deepEqual(ema(candles,2),[null,1.5,2.5,3.5]);
  assert.throws(()=>sma(candles,1),RangeError);
  assert.throws(()=>ema([{close:NaN}],2),TypeError);
});
test('backoff is bounded and rejects invalid retry counts',()=>{
  assert.equal(reconnectDelay(0),RECONNECT_DELAYS_MS[0]);
  assert.equal(reconnectDelay(999),RECONNECT_DELAYS_MS.at(-1));
  assert.throws(()=>reconnectDelay(-1),TypeError);
});
test('depth input parsing rejects invalid symbol, malformed levels and crossed snapshots',()=>{
  assert.equal(parseDepthEvent('{'),null);
  assert.equal(parseDepthEvent({...event(100,101,99),s:'ETHUSDT'}),null);
  assert.equal(parseDepthEvent(event(100,101,99,[['99','-1']])),null);
  assert.equal(parseDepthSnapshot({...snap,asks:[['98','1']]}),null);
  assert.deepEqual(parseDepthSnapshot(snap).lastUpdateId,100);
});
test('depth book requires snapshot and anchor, enforces continuous sequence',()=>{
  const book=createLocalDepthBook();
  assert.equal(book.apply(parseDepthEvent(event(100,101,99))),'uninitialized');
  book.replace(snap);
  assert.equal(book.anchored,false);
  assert.equal(book.apply(parseDepthEvent(event(102,103,101))),'gap');
  assert.equal(book.apply(parseDepthEvent(event(100,101,99))),'applied');
  assert.equal(book.anchored,true);
  assert.equal(book.updateId,101);
  assert.equal(book.bids.get(99),4);
  assert.equal(book.apply(parseDepthEvent(event(100,101,99))),'ignored');
  assert.equal(book.apply(parseDepthEvent(event(102,103,999))),'gap');
  assert.equal(book.updateId,101);
  assert.equal(book.apply(parseDepthEvent(event(102,103,101))),'applied');
});
test('depth book reports invalid crossed and excessive levels without pretending valid',()=>{
  const book=createLocalDepthBook();book.replace(snap);
  assert.equal(book.apply(parseDepthEvent(event(100,101,99,[['102','2']]))),'crossed');
});
test('confluence fails closed for unsynchronized, unavailable observations',()=>{
  assert.equal(evaluateConfluence([],0).status,'UNAVAILABLE');
  assert.equal(evaluateConfluence([{at:0},{at:2000}],1).status,'UNAVAILABLE');
});
test('confluence explains valid descriptive observations, not signals',()=>{
  const base={at:0,bucketSize:50,flowStatus:'LIVE',depthStatus:'LIVE',priceStatus:'LIVE',price:100,flow:{cvdBtc:2,segment:1},bands:[{side:'bid',lower:90,notional:100}]};
  const next={...base,at:2000,price:101,flow:{cvdBtc:4,segment:1},bands:[{side:'bid',lower:90,notional:130}]};
  const result=evaluateConfluence([base,next],1);
  assert.equal(result.status,'OBSERVED');assert.equal(result.deltaBtc,2);assert.equal(result.bidNotionalChange,30);
  assert.equal(evaluateConfluence([base,{...next,flow:{...next.flow,segment:2}}],1).status,'UNAVAILABLE');
});
