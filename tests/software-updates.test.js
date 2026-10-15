import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, compareVersions, selectRelease, createUpdateController } from '../app/software-updates.js';

const release = (tag_name, prerelease = false) => ({
 tag_name, prerelease, draft: false, published_at: '2026-10-15T12:00:00Z'
});
test('strict version comparison and pre-release precedence', () => {
 assert.equal(compareVersions('1.22.0','1.9.0'), 1);
 assert.equal(compareVersions('1.22.0-rc.2','1.22.0-rc.10'), -1);
 assert.equal(compareVersions('1.22.0','1.22.0-rc.1'), 1);
 assert.equal(compareVersions('v1.22.0','1.22.0'), 0);
 for (const invalid of ['1.2','1.2.3.4','01.2.3','1.2.3-01','hi','1.2.3<script>']) assert.equal(parseVersion(invalid), null);
});
test('select only released eligible versions', () => {
 assert.equal(selectRelease([], '1.22.0').status,'UNSUPPORTED');
 assert.equal(selectRelease([release('v1.23.0', true)],'1.22.0').status,'UNSUPPORTED');
 assert.equal(selectRelease([{...release('v9.0.0'),draft:true},release('v1.22.0')],'1.22.0').status,'UP_TO_DATE');
 assert.equal(selectRelease([release('v1.23.0')],'1.22.0').status,'UPDATE_AVAILABLE');
 assert.equal(selectRelease([release('v1.23.0-rc.1',true)],'1.22.0','preview').status,'PREVIEW_AVAILABLE');
 assert.equal(selectRelease([release('v1.21.0')],'1.22.0').status,'UP_TO_DATE');
 assert.equal(selectRelease([release('v1.23.0-rc.1',false)],'1.22.0').status,'UNSUPPORTED');
});
test('check deduplicates requests and persists latest result', async () => {
 let calls=0, persisted={};
 const api={runtime:{getManifest:()=>({version:'1.22.0'})},storage:{local:{
   get:async()=>persisted,set:async x=>{persisted={...persisted,...x}}
 }}};
 const fetchFn=async()=>{calls++;return {ok:true,status:200,json:async()=>[release('v1.23.0')]};};
 const controller=createUpdateController({api,fetchFn,now:()=>Date.now()});
 const [a,b]=await Promise.all([controller.check(),controller.check()]);
 assert.equal(calls,1);
 assert.equal(a.status,'UPDATE_AVAILABLE');
 assert.deepEqual(a,b);
 await controller.check();
 assert.equal(calls,1);
 await controller.check({force:true});
 assert.equal(calls,2);
});
test('failed lookups do not claim up-to-date', async () => {
 let persisted={};
 const api={runtime:{getManifest:()=>({version:'1.22.0'})},storage:{local:{
  get:async()=>persisted,set:async x=>{persisted={...persisted,...x}}
 }}};
 const c=createUpdateController({api,fetchFn:async()=>{throw Error('offline')}});
 const state=await c.check();
 assert.equal(state.error,'CHECK_FAILED');
 assert.notEqual(state.status,'UP_TO_DATE');
});
