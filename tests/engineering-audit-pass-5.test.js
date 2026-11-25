import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceController } from '../ui/workspace.js';
import { createTerminalExperience } from '../ui/terminal-experience.js';
import { WORKSPACE_VIEWS } from '../storage/workspace-preferences.js';

function fixture() {
  const root = {activeElement:null};
  const nodes = new Map();
  function node(dataset={}) {
    return {dataset,hidden:false,value:'',children:[],attrs:new Map(),handlers:new Map(),
      addEventListener(k,f){this.handlers.set(k,f);},removeEventListener(k){this.handlers.delete(k);},
      setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);},
      focus(){root.activeElement=this;},contains(other){return this.children.includes(other);}};
  }
  root.getElementById=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  const links=WORKSPACE_VIEWS.map(view=>node({workspaceTarget:view}));
  const panels=WORKSPACE_VIEWS.map(view=>node({workspacePanel:view}));
  const nav=root.getElementById('dashboardWorkspaceNav');nav.querySelectorAll=()=>links;
  root.querySelectorAll=()=>panels;
  return {root,links,panels,nav,node};
}
test('AUD-18: storage changes preserve active allowed workspace and restore hidden focus',()=>{
  const f=fixture();const c=createWorkspaceController({root:f.root});
  c.navigate('analytics');const child=f.node();f.panels[1].children.push(child);child.focus();
  c.sync({preset:'custom',landingView:'settings'});
  assert.equal(c.active(),'analytics');assert.equal(f.root.activeElement,child);
  c.sync({preset:'simple',landingView:'settings'});
  assert.equal(c.active(),'live');assert.equal(f.root.activeElement,f.links[0]);
  c.navigate('alerts');c.sync({preset:'advanced',landingView:'replay'});
  assert.equal(c.active(),'alerts');
  c.dispose();
});
test('AUD-19: workspace does not consume modified or previously handled keys',()=>{
  const f=fixture();const c=createWorkspaceController({root:f.root});let count=0;
  const key=extra=>f.nav.handlers.get('keydown')({key:'ArrowRight',target:f.links[0],preventDefault(){count++;},...extra});
  for(const modifier of ['altKey','ctrlKey','metaKey','shiftKey','defaultPrevented'])key({[modifier]:true});
  assert.equal(count,0);assert.equal(c.active(),'live');
  key({});assert.equal(count,1);assert.equal(c.active(),'analytics');
  c.dispose();
});
test('AUD-20: Escape prioritizes an open disclosure; repeated/handled shortcuts do not toggle focus',()=>{
  const f=fixture();f.root.handlers=new Map();
  f.root.addEventListener=(k,fn)=>f.root.handlers.set(k,fn);
  f.root.removeEventListener=k=>f.root.handlers.delete(k);
  const c=createTerminalExperience({root:f.root,storage:null,navigate:()=>true});
  const openDetails={closest:selector=>selector==='details[open]'?{}:null};
  let consumed=0;
  const key=(key,target={},extra={})=>f.root.handlers.get('keydown')({key,target,preventDefault(){consumed++;},...extra});
  c.setFocus(true);
  key('Escape',openDetails);assert.equal(c.focus(),true);assert.equal(consumed,0);
  key('f',{}, {repeat:true});assert.equal(c.focus(),true);
  key('f',{}, {defaultPrevented:true});assert.equal(c.focus(),true);
  key('f',{}, {isComposing:true});assert.equal(c.focus(),true);
  key('Escape');assert.equal(c.focus(),false);assert.equal(consumed,1);
  c.dispose();
});
