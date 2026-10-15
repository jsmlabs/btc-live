import {createAdvancedAlertEngine,validateAdvancedRule} from '../app/advanced-alert-engine.js';
import {loadAdvancedRules,saveAdvancedRules,loadAdvancedState,saveAdvancedState} from '../storage/advanced-alert-rules.js';
import {createNativeNotification} from '../app/notifications.js';
import {appendAlertHistory} from '../storage/alert-history.js';
export function createAdvancedAlertCenter({root=document,now=()=>Date.now(),notify=createNativeNotification}={}){
  const engine=createAdvancedAlertEngine({now});
  let rules=[],ready=false,tail=Promise.resolve(),lastObserved=0;
  const get=id=>root.getElementById(id);
  function render(){
    const list=get('advancedAlertRules');if(!list)return;list.replaceChildren();
    for(const rule of rules){
      const li=root.createElement('li');li.className='advanced-alert-rule';
      const span=root.createElement('span');span.textContent=`${rule.type.toUpperCase()} ${rule.direction} ${rule.threshold} (${rule.windowSeconds}s, cooldown ${rule.cooldownSeconds}s)`;
      const remove=root.createElement('button');remove.type='button';remove.className='button tertiary';remove.textContent='Remove';
      remove.addEventListener('click',()=>{tail=tail.then(async()=>{rules=await saveAdvancedRules(rules.filter(x=>x.id!==rule.id));render();});});
      li.append(span,remove);list.append(li);
    }
  }
  async function initialize(){try {rules=await loadAdvancedRules();engine.restoreState(await loadAdvancedState());ready=true;render();}catch(e){console.warn('Advanced alert setup failed',e);}}
  async function process(data,settings){
    if(!ready||!settings?.notificationsEnabled||!rules.length)return;
    // Serialize observation and state persistence across dashboard tabs.
    // Reload within the lock so another tab's most recent state is authoritative.
    const run=async()=>{
    engine.restoreState(await loadAdvancedState());
    const outcomes=engine.observe(rules,data);
    // Persist a claimed trigger before attempting notification. A failed delivery
    // is recorded as failed, not retried blindly (at-most-once attempt).
    await saveAdvancedState(engine.exportState());
    for(const outcome of outcomes.filter(o=>o.status==='triggered')){
      const rule=rules.find(r=>r.id===outcome.id);if(!rule)continue;
      const title=`BTC Live ${rule.type} alert`;
      const message=`Observed ${rule.type}: ${outcome.value.toFixed(5)} (${rule.direction} ${rule.threshold}). Live-only rule.`;
      let status='sent',reason=null;
      try {if(await notify({id:`btc-live-advanced-${rule.id}`,title,message})===false){status='failed';reason='notification_unavailable';}}
      catch(e){status='failed';reason='notification_error';console.warn('Advanced notification failed',e);}
      try{await appendAlertHistory({id:`advanced-${rule.id}-${outcome.at}`,at:outcome.at,type:'advanced',status,source:'dashboard',title,message,reason,currentPrice:data.price});}
      catch(e){console.warn('Advanced alert history failed',e);}
    }
    };
    const locks=globalThis.navigator?.locks;
    if (!locks?.request) {
      // Without cross-tab locking, do not risk multiple tabs sending the same alert.
      // Advanced alerts remain disabled; legacy background price alerts are unaffected.
      return;
    }
    await locks.request('btc-live-advanced-alert-engine',{mode:'exclusive'},run);
  }
  function observe(data,settings){
    if(!ready||!rules.length||!settings?.notificationsEnabled)return;
    const at=now();if(at-lastObserved<1000)return;lastObserved=at;
    tail=tail.then(()=>process(data,settings)).catch(e=>console.warn('Advanced alert processing failed',e));
  }
  get('advancedAlertForm')?.addEventListener('submit',event=>{
    event.preventDefault();const type=get('advancedAlertType').value;
    const candidate=validateAdvancedRule({id:`rule-${globalThis.crypto?.randomUUID?.()??Date.now().toString(36)}`,type,
      direction:get('advancedAlertDirection').value,threshold:Number(get('advancedAlertThreshold').value),
      windowSeconds:Number(get('advancedAlertWindow').value),cooldownSeconds:Number(get('advancedAlertCooldown').value),hysteresisPercent:1});
    const feedback=get('advancedAlertFeedback');
    if(!candidate||rules.length>=30){feedback.textContent='Invalid rule or 30-rule limit reached.';return;}
    tail=tail.then(async()=>{rules=await saveAdvancedRules([...rules,candidate]);render();feedback.textContent='Live-only rule saved.';})
      .catch(e=>{feedback.textContent='Could not save rule.';console.warn(e);});
  });
  return {initialize,observe};
}
