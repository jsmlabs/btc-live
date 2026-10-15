import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderFlowAccumulator} from '../ui/order-flow.js';
import {evaluateConfluence, evaluatePriceDeltaDivergence} from '../ui/confluence.js';
import {evaluateLiquidityPersistence} from '../ui/liquidity-behavior.js';
const trade=(id,side,quantity=1)=>({id,side,quantity,notional:quantity*100,tradeAt:id*1000});
test('multiwindow delta returns exact signed flow and keeps 60s legacy output',()=>{
 const a=createOrderFlowAccumulator();
 for(let i=0;i<=310;i++)a.ingest(trade(i+1,i%2?'sell':'buy'),i*1000,1);
 const s=a.snapshot(310000,'LIVE');
 assert.equal(s.points.length,60);assert.equal(s.count,60);
 assert.equal(s.windows['10000'].status,'OBSERVED');assert.equal(s.windows['10000'].count,10);
 assert.equal(s.windows['300000'].count,300);
 assert.equal(s.windows['10000'].deltaBtc,0);
 assert.equal(s.windows['300000'].deltaBtc,0);
});
test('initial, stale and segment-reset windows are unavailable instead of fabricated',()=>{
 const a=createOrderFlowAccumulator();a.ingest(trade(1,'buy'),10000,1);
 assert.equal(a.snapshot(10000,'LIVE').windows['10000'].status,'UNAVAILABLE');
 assert.equal(a.snapshot(20001,'LIVE').windows['10000'].status,'UNAVAILABLE');
 a.ingest(trade(2,'sell'),21000,2);
 assert.equal(a.snapshot(21000,'LIVE').windows['10000'].status,'UNAVAILABLE');
 assert.equal(a.snapshot(50000,'STALE').windows['10000'].status,'UNAVAILABLE');
});
test('divergence only on continuous same-segment valid observations',()=>{
 const f=[100,101,102,103].map((price,i)=>({at:i*2000,price,priceStatus:'LIVE',flowStatus:'LIVE',flow:{segment:5,cvdBtc:[0,2,4,3][i]}}));
 assert.equal(evaluatePriceDeltaDivergence(f,3).direction,'BEARISH_DIVERGENCE');
 assert.equal(evaluatePriceDeltaDivergence(f,2).status,'UNAVAILABLE');
 assert.equal(evaluatePriceDeltaDivergence(f.map((x,i)=>i===1?{...x,flow:{...x.flow,segment:6}}:x),3).status,'UNAVAILABLE');
 assert.equal(evaluatePriceDeltaDivergence(f.map((x,i)=>i===2?{...x,at:4500}:x),3).status,'UNAVAILABLE');
});
test('confluence explains observed inputs and rejects discontinuity',()=>{
 const f=[0,2000].map((at,i)=>({at,bucketSize:10,price:100+i,priceStatus:'LIVE',flowStatus:'LIVE',depthStatus:'LIVE',flow:{segment:1,cvdBtc:i+1},bands:[{side:'bid',lower:90,notional:100+i}]}));
 const r=evaluateConfluence(f,1);assert.equal(r.status,'OBSERVED');assert.equal(r.inputs.currentAt,2000);assert.deepEqual(r.reasons,[]);
 assert.equal(evaluateConfluence([f[0],{...f[1],at:6000}],1).status,'UNAVAILABLE');
});
test('persistence measures repeated levels and visible notional changes',()=>{
 const history={stepMs:2000,samples:[0,2000,4000].map((at,i)=>({at,bands:[{side:'bid',lower:90,notional:100+i*10},{side:'ask',lower:110,notional:50}]}))};
 const r=evaluateLiquidityPersistence(history,4000,3);assert.equal(r.status,'OBSERVED');
 assert.equal(r.zones[0].consecutive,3);assert.equal(r.zones[0].netNotionalChange,20);
 assert.equal(evaluateLiquidityPersistence({...history,samples:[history.samples[0],{...history.samples[1],at:2500},history.samples[2]]},4000,3).status,'UNAVAILABLE');
 assert.equal(evaluateLiquidityPersistence(history,11000,3).status,'UNAVAILABLE');
});
