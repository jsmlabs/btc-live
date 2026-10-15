import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAdvancedRule,sanitizeAdvancedRules,evaluateAdvancedMetric,createAdvancedAlertEngine} from '../app/advanced-alert-engine.js';
const rule=(extras={})=>({id:'r1',type:'price',direction:'above',threshold:100000,windowSeconds:60,cooldownSeconds:60,hysteresisPercent:1,...extras});
test('strict rule validation including negative CVD and book imbalance',()=>{
  assert.equal(validateAdvancedRule(rule({type:'cvd',threshold:-3}))?.threshold,-3);
  assert.equal(validateAdvancedRule(rule({type:'imbalance',threshold:-0.25}))?.threshold,-0.25);
  assert.equal(validateAdvancedRule(rule({type:'price',threshold:-2})),null);
  assert.equal(validateAdvancedRule(rule({type:'imbalance',threshold:2})),null);
  assert.equal(validateAdvancedRule(rule({id:'../bad'})),null);
  assert.equal(sanitizeAdvancedRules([rule(),rule()]).length,1);
});
test('fails closed on stale or incomplete flow and depth',()=>{
  const cvd=validateAdvancedRule(rule({type:'cvd',threshold:3}));
  assert.equal(evaluateAdvancedMetric(cvd,{trades:{status:'LIVE',updatedAt:8000},flow:{windows:{'60000':{status:'OBSERVED',deltaBtc:9}}}},12000).reason,'trade_feed_unavailable');
  assert.equal(evaluateAdvancedMetric(cvd,{trades:{status:'LIVE',updatedAt:9000},flow:{windows:{'60000':{status:'UNAVAILABLE'}}}},10000).reason,'window_incomplete');
  const depth=validateAdvancedRule(rule({type:'imbalance',threshold:0.1}));
  assert.equal(evaluateAdvancedMetric(depth,{depth:{status:'LIVE',updatedAt:5000}},10000).reason,'depth_unavailable');
  const metric=evaluateAdvancedMetric(depth,{depth:{status:'LIVE',updatedAt:9000,book:{bids:new Map([[1,30]]),asks:new Map([[2,10]])}}},10000);
  assert.equal(metric.value,0.5);
});
test('hysteresis, deduplication and cooldown are independent',()=>{
  let at=100000;
  const engine=createAdvancedAlertEngine({now:()=>at});const r=rule();
  const value=price=>({price,priceValid:true});
  assert.equal(engine.observe([r],value(100001))[0].status,'triggered');
  assert.equal(engine.observe([r],value(100002))[0].reason,'deduplicated');
  at+=1000;engine.observe([r],value(98000));
  assert.equal(engine.observe([r],value(100001))[0].reason,'cooldown');
  at+=61000;
  assert.equal(engine.observe([r],value(100001))[0].status,'triggered');
});
test('reconnection invalidates armed threshold state, and state can be restored',()=>{
  let at=100000;const first=createAdvancedAlertEngine({now:()=>at});const r=rule();
  first.observe([r],{price:100500,priceValid:true});
  const second=createAdvancedAlertEngine({now:()=>at});second.restoreState(first.exportState());
  assert.equal(second.observe([r],{price:100501,priceValid:true})[0].reason,'deduplicated');
  assert.equal(second.observe([r],{priceValid:false})[0].reason,'price_unavailable');
  at+=61000;
  assert.equal(second.observe([r],{price:100502,priceValid:true})[0].status,'triggered');
});
test('disabled rules and malformed state cannot trigger',()=>{
  const engine=createAdvancedAlertEngine({now:()=>100000});engine.restoreState({r1:{armed:'yes',lastSentAt:-1}});
  assert.equal(engine.observe([rule({enabled:false})],{price:120000,priceValid:true}).length,0);
  assert.equal(engine.observe([rule()],{price:0,priceValid:false})[0].status,'suppressed');
});
