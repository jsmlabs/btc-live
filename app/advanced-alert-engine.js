/** Deterministic view-only alert evaluation. Replay inputs must never call observe(). */
export const ADVANCED_RULE_TYPES = Object.freeze(['price','cvd','volume','imbalance']);
export const ADVANCED_RULE_LIMIT = 30;
export function validateAdvancedRule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { id, type, direction, threshold, windowSeconds = 60, cooldownSeconds = 300, hysteresisPercent = 1 } = value;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || !ADVANCED_RULE_TYPES.includes(type) ||
      !['above','below'].includes(direction) || !Number.isFinite(threshold) || threshold < (type === 'cvd' ? -10_000_000 : type === 'imbalance' ? -1 : 0) || threshold > (type === 'imbalance' ? 1 : 10_000_000) ||
      ![10,30,60,300].includes(windowSeconds) || !Number.isInteger(cooldownSeconds) || cooldownSeconds < 15 || cooldownSeconds > 86_400 ||
      !Number.isFinite(hysteresisPercent) || hysteresisPercent < 0 || hysteresisPercent > 25) return null;
  if (type === 'price' && threshold < 100) return null;
  if (type === 'imbalance' && threshold > 1) return null;
  return { id,type,direction,threshold,windowSeconds,cooldownSeconds,hysteresisPercent,enabled:value.enabled !== false };
}
export function sanitizeAdvancedRules(input) {
  const seen = new Set(); const result=[];
  for (const item of Array.isArray(input) ? input.slice(0,200) : []) {
    const rule=validateAdvancedRule(item);
    if (rule && !seen.has(rule.id)) { seen.add(rule.id); result.push(rule); }
    if (result.length >= ADVANCED_RULE_LIMIT) break;
  }
  return result;
}
export function evaluateAdvancedMetric(rule, data, at) {
  if (!Number.isSafeInteger(at) || at < 0 || !rule) return {valid:false,reason:'invalid_input'};
  if (rule.type === 'price') {
    const price=data?.price;
    if (!data?.priceValid || !Number.isFinite(price) || price <= 0) return {valid:false,reason:'price_unavailable'};
    return {valid:true,value:price};
  }
  if (rule.type === 'cvd' || rule.type === 'volume') {
    if (data?.trades?.status !== 'LIVE' || !Number.isSafeInteger(data.trades.updatedAt) ||
        at < data.trades.updatedAt || at - data.trades.updatedAt > 3000) return {valid:false,reason:'trade_feed_unavailable'};
    const window=data?.flow?.windows?.[String(rule.windowSeconds*1000)];
    if (window?.status !== 'OBSERVED') return {valid:false,reason:'window_incomplete'};
    const value=rule.type==='cvd' ? window.deltaBtc : (window.buyBtc + window.sellBtc);
    return Number.isFinite(value) ? {valid:true,value} : {valid:false,reason:'metric_unavailable'};
  }
  if (data?.depth?.status !== 'LIVE' || !Number.isSafeInteger(data.depth.updatedAt) ||
      at < data.depth.updatedAt || at-data.depth.updatedAt > 3000) return {valid:false,reason:'depth_unavailable'};
  const book=data.depth.book;
  if (!(book?.bids instanceof Map) || !(book?.asks instanceof Map)) return {valid:false,reason:'depth_unavailable'};
  const bid=Array.from(book.bids.values()).reduce((sum,n)=>sum+(Number.isFinite(n)&&n>0?n:0),0);
  const ask=Array.from(book.asks.values()).reduce((sum,n)=>sum+(Number.isFinite(n)&&n>0?n:0),0);
  if (!(bid>0&&ask>0)) return {valid:false,reason:'depth_unavailable'};
  return {valid:true,value:(bid-ask)/(bid+ask)};
}
export function createAdvancedAlertEngine({now=()=>Date.now()}={}) {
  const states=new Map();
  function observe(rules,data) {
    const at=now(); const results=[];
    const clean=sanitizeAdvancedRules(rules);
    for(const rule of clean) {
      if (!rule.enabled) continue;
      const metric=evaluateAdvancedMetric(rule,data,at);
      const state=states.get(rule.id)??{armed:true,lastSentAt:null};
      if (!metric.valid) { states.set(rule.id,{...state,armed:true}); results.push({id:rule.id,status:'suppressed',reason:metric.reason}); continue; }
      const reached=rule.direction==='above' ? metric.value>=rule.threshold : metric.value<=rule.threshold;
      const margin=Math.max(Math.abs(rule.threshold)*rule.hysteresisPercent/100,rule.type==='imbalance'?0.001:0.000001);
      const reset=rule.direction==='above' ? metric.value<rule.threshold-margin : metric.value>rule.threshold+margin;
      if (reset) state.armed=true;
      let status='idle',reason=null;
      if(reached){
        if (!state.armed) { status='suppressed';reason='deduplicated'; }
        else if (state.lastSentAt !== null && at-state.lastSentAt<rule.cooldownSeconds*1000) {status='suppressed';reason='cooldown';}
        else {status='triggered';state.armed=false;state.lastSentAt=at;}
      }
      states.set(rule.id,state);
      results.push({id:rule.id,type:rule.type,status,reason,value:metric.value,at});
    }
    for(const key of states.keys())if(!clean.some(rule=>rule.id===key))states.delete(key);
    return results;
  }
  function exportState() {return Object.fromEntries([...states].map(([id,s])=>[id,{...s}]));}
  function restoreState(input) {
    states.clear();if(!input||typeof input!=='object')return;
    for(const [id,s] of Object.entries(input).slice(0,ADVANCED_RULE_LIMIT)) {
      if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||!s||typeof s.armed!=='boolean')continue;
      const lastSentAt=s.lastSentAt===null?null:Number.isSafeInteger(s.lastSentAt)&&s.lastSentAt>=0?s.lastSentAt:null;
      states.set(id,{armed:s.armed,lastSentAt});
    }
  }
  return {observe,exportState,restoreState};
}
