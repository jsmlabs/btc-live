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

test('switching release channels invalidates previous cached results', async () => {
 let state={};
 const api={runtime:{getManifest:()=>({version:'1.22.0'})},storage:{local:{
   get:async()=>state,set:async x=>{state={...state,...x}}
 }}};
 let calls=0;
 const controller=createUpdateController({api,fetchFn:async()=>{
   calls++;
   return {ok:true,status:200,json:async()=>[release('v1.23.0-rc.1',true)]};
 }});
 const stable=await controller.check();
 assert.equal(stable.status,'UNSUPPORTED');
 const preview=await controller.configure({channel:'preview'});
 assert.equal(preview.status,'NOT_CHECKED');
 assert.equal(preview.lastSuccessAt,null);
 assert.equal(preview.release,null);
 const checked=await controller.check();
 assert.equal(checked.status,'PREVIEW_AVAILABLE');
 assert.equal(calls,2);
});
test('failures are throttled but a manual retry still runs', async () => {
 let persisted={}, count=0;
 const api={runtime:{getManifest:()=>({version:'1.22.0'})},storage:{local:{
   get:async()=>persisted,set:async x=>{persisted={...persisted,...x}}
 }}};
 const controller=createUpdateController({api,fetchFn:async()=>{count++; throw Error('network');}});
 const a=await controller.check();
 assert.equal(a.error,'CHECK_FAILED');
 assert.ok(a.retryAfter>Date.now());
 await controller.check();
 assert.equal(count,1);
 await controller.check({force:true});
 assert.equal(count,2);
});

test('HTTP-date Retry-After is honored with bounded rate-limit delay', async () => {
 let persisted = {};
 const time = Date.now();
 const api = {runtime:{getManifest:()=>({version:'1.22.0'})},storage:{local:{
  get:async()=>persisted,set:async x=>{persisted={...persisted,...x}}
 }}};
 const controller = createUpdateController({api,now:()=>time,fetchFn:async()=>({
  ok:false,status:429,headers:{get:()=>new Date(time + 2 * 60 * 60 * 1000).toUTCString()}
 })});
 const state = await controller.check();
 assert.equal(state.error,'RATE_LIMITED');
 assert.ok(Math.abs(state.retryAfter - (time + 2 * 60 * 60 * 1000)) < 1000);
});
test('invalid Retry-After uses conservative one-hour fallback', async () => {
 let persisted = {};
 const time = Date.now();
 const api = {runtime:{getManifest:()=>({version:'1.22.0'})},storage:{local:{
  get:async()=>persisted,set:async x=>{persisted={...persisted,...x}}
 }}};
 const controller = createUpdateController({api,now:()=>time,fetchFn:async()=>({
  ok:false,status:403,headers:{get:()=> 'not-a-date'}
 })});
 const state = await controller.check();
 assert.equal(state.retryAfter,time + 3600000);
});
