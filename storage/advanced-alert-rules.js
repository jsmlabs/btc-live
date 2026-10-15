import {sanitizeAdvancedRules,ADVANCED_RULE_LIMIT} from '../app/advanced-alert-engine.js';
export const ADVANCED_RULES_KEY='btcLiveAdvancedRules';
export const ADVANCED_STATE_KEY='btcLiveAdvancedRuleState';
function api(){return (globalThis.browser??globalThis.chrome)?.storage?.local;}
export async function loadAdvancedRules(){const storage=api();if(!storage)return [];return sanitizeAdvancedRules((await storage.get(ADVANCED_RULES_KEY))?.[ADVANCED_RULES_KEY]);}
export async function saveAdvancedRules(rules){const clean=sanitizeAdvancedRules(rules);await api()?.set({[ADVANCED_RULES_KEY]:clean});return clean;}
export function sanitizeAdvancedState(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {};
  const result=Object.create(null);
  for(const [id,state] of Object.entries(input).slice(0,ADVANCED_RULE_LIMIT)){
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||!state||typeof state!=='object'||typeof state.armed!=='boolean')continue;
    const stamp=state.lastSentAt;
    if(stamp!==null&&(!Number.isSafeInteger(stamp)||stamp<0))continue;
    result[id]={armed:state.armed,lastSentAt:stamp};
  }
  return result;
}
export async function loadAdvancedState(){const storage=api();return sanitizeAdvancedState(storage?(await storage.get(ADVANCED_STATE_KEY))?.[ADVANCED_STATE_KEY]:null);}
export async function saveAdvancedState(state){await api()?.set({[ADVANCED_STATE_KEY]:sanitizeAdvancedState(state)});}
