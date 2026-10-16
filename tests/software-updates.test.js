import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, compareVersions, selectRelease, sanitizeUpdateState, createUpdateController } from '../app/software-updates.js';

const release = (tag_name, prerelease = false) => ({
 tag_name, prerelease, draft: false, published_at: '2026-10-15T12:00:00Z'
});
test('strict version comparison and pre-release precedence', () => {
 assert.equal(compareVersions('1.22.0','1.9.0'), 1);
 assert.equal(compareVersions('1.22.0-rc.2','1.22.0-rc.10'), -1);
 assert.equal(compareVersions('1.22.0','1.22.0-rc.1'), 1);
 assert.equal(compareVersions('v1.22.0','1.22.0'), 0);
 assert.equal(compareVersions('1.24.1+build.20','1.24.1+build.1'), 0);
 assert.equal(compareVersions('1.24.2-rc.1+build.5','1.24.2-rc.2'), -1);
 assert.deepEqual(parseVersion('v1.24.1+build.20')?.pre, []);
 assert.equal(parseVersion('1.24.1+bad..build'), null);
 for (const invalid of ['1.2','1.2.3.4','01.2.3','1.2.3-01','hi','1.2.3<script>']) assert.equal(parseVersion(invalid), null);
});
test('select only released eligible versions', () => {
 assert.equal(selectRelease([], '1.22.0').status,'UNSUPPORTED');
 assert.equal(selectRelease([release('v1.23.0', true)],'1.22.0').status,'UNSUPPORTED');
 assert.equal(selectRelease([{...release('v9.0.0'),draft:true},release('v1.22.0')],'1.22.0').status,'UP_TO_DATE');
 assert.equal(selectRelease([release('v1.23.0')],'1.22.0').status,'UPDATE_AVAILABLE');
 assert.equal(selectRelease([release('v1.23.0-rc.1',true)],'1.22.0','preview').status,'PREVIEW_AVAILABLE');
 assert.equal(selectRelease([release('v1.21.0')],'1.22.0').status,'INSTALLED_AHEAD');
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

test('stale installed-version cache cannot advertise a release for the previous installation', async () => {
 const stored = {enabled:true,channel:'stable',checkedInstalled:'1.22.0',
  status:'UPDATE_AVAILABLE',lastSuccessAt:Date.now(),lastAttemptAt:Date.now(),
  release:{version:'1.23.0',url:'https://github.com/jsmlabs/btc-live/releases/tag/v1.23.0',prerelease:false}};
 assert.equal(sanitizeUpdateState(stored,'1.24.0').status,'NOT_CHECKED');
 assert.equal(sanitizeUpdateState(stored,'1.24.0').release,null);
 assert.equal(sanitizeUpdateState(stored,'1.24.0').lastSuccessAt,null);
 let requests=0;
 const api={runtime:{getManifest:()=>({version:'1.24.0'})},storage:{local:{
  get:async()=>({[ 'btcLiveSoftwareUpdates' ]:stored}),
  set:async x=>Object.assign(stored,x.btcLiveSoftwareUpdates)
 }}};
 const controller=createUpdateController({api,fetchFn:async()=>{requests++;return {ok:true,json:async()=>[]};}});
 const result=await controller.check();
 assert.equal(requests,1);
 assert.equal(result.status,'UNSUPPORTED');
 assert.equal(result.installed,'1.24.0');
});

test('untrusted cached releases cannot supply a foreign URL or inconsistent channel/status', () => {
 const time=Date.now();
 const raw={enabled:true,channel:'stable',checkedInstalled:'1.24.0',
   lastSuccessAt:time,status:'UP_TO_DATE',
   release:{version:'1.25.0',url:'javascript:alert(1)',prerelease:false}};
 assert.equal(sanitizeUpdateState(raw,'1.24.0').release,null);
 assert.equal(sanitizeUpdateState(raw,'1.24.0').status,'NOT_CHECKED');
 raw.release.url='https://github.com/jsmlabs/btc-live/releases/tag/v1.25.0';
 assert.equal(sanitizeUpdateState(raw,'1.24.0').status,'UPDATE_AVAILABLE');
 raw.release={version:'1.25.0-rc.1',url:'https://github.com/jsmlabs/btc-live/releases/tag/v1.25.0-rc.1',prerelease:true};
 assert.equal(sanitizeUpdateState(raw,'1.24.0').status,'NOT_CHECKED');
 raw.channel='preview';
 assert.equal(sanitizeUpdateState(raw,'1.24.0').status,'PREVIEW_AVAILABLE');
});

test('malformed successful HTTP payload does not masquerade as no published release', async () => {
 let stored={};
 const api={runtime:{getManifest:()=>({version:'1.24.0'})},storage:{local:{
  get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const controller=createUpdateController({api,fetchFn:async()=>({ok:true,json:async()=>({message:'invalid shape'})})});
 const state=await controller.check();
 assert.equal(state.status,'NOT_CHECKED');
 assert.equal(state.error,'CHECK_FAILED');
 assert.equal(state.lastSuccessAt,null);
 assert.ok(state.retryAfter>Date.now());
});

test('offline failures are distinct from unknown API failures', async () => {
 let stored={};
 const api={runtime:{getManifest:()=>({version:'1.24.0'})},storage:{local:{
  get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const controller=createUpdateController({api,isOnline:()=>false,fetchFn:async()=>{throw Error('network');}});
 assert.equal((await controller.check()).error,'OFFLINE');
});

test('configuration writes serialize after concurrent requests and invalidate release channel', async () => {
 let stored={},finishFetch;
 const api={runtime:{getManifest:()=>({version:'1.24.0'})},storage:{local:{
  get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const controller=createUpdateController({api,fetchFn:()=>new Promise(resolve=>{finishFetch=resolve;})});
 const pending=controller.check();
 await new Promise(resolve=>setImmediate(resolve));
 const changed=controller.configure({channel:'preview'});
 finishFetch({ok:true,status:200,json:async()=>[release('v1.25.0')]});
 assert.equal((await pending).status,'UPDATE_AVAILABLE');
 const newState=await changed;
 assert.equal(newState.channel,'preview');
 assert.equal(newState.status,'NOT_CHECKED');
 assert.equal(newState.release,null);
 assert.equal((await controller.read()).channel,'preview');
});

test('manual force can check when automatic daily checks are disabled', async () => {
 let stored={},requests=0;
 const api={runtime:{getManifest:()=>({version:'1.24.0'})},storage:{local:{
  get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const controller=createUpdateController({api,fetchFn:async()=>{requests++;return {ok:true,json:async()=>[]};}});
 await controller.configure({enabled:false});
 assert.equal((await controller.check()).status,'NOT_CHECKED');
 assert.equal(requests,0);
 const forced=await controller.check({force:true});
 assert.equal(forced.status,'UNSUPPORTED');
 assert.equal(forced.enabled,false);
 assert.equal(requests,1);
});

test('release discovery continues beyond the first page when previews hide a stable release', async () => {
 let stored = {}, urls = [];
 const api = {runtime:{getManifest:()=>({version:'1.24.1'})},storage:{local:{
  get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const previews = Array.from({length:100},(_,i)=>release('v1.25.0-rc.'+(i+1),true));
 const controller = createUpdateController({api,fetchFn:async url=>{
  urls.push(url);
  return {ok:true,status:200,json:async()=>urls.length===1?previews:[release('v1.25.0')]};
 }});
 const state=await controller.check();
 assert.equal(state.status,'UPDATE_AVAILABLE');
 assert.equal(state.release.version,'1.25.0');
 assert.deepEqual(urls.map(u=>new URL(u).searchParams.get('page')),['1','2']);
 assert.ok(urls.every(u=>new URL(u).searchParams.get('per_page')==='100'));
});

test('discovery selects the highest semantic release even if a later page contains it', async () => {
 let persisted={},page=0;
 const api={runtime:{getManifest:()=>({version:'1.24.1'})},storage:{local:{
  get:async()=>persisted,set:async x=>{persisted={...persisted,...x}}
 }}};
 const first=Array.from({length:100},(_,i)=>release('v1.25.0-rc.'+(i+1),true));
 const controller=createUpdateController({api,fetchFn:async()=>{
  page++;
  return {ok:true,status:200,json:async()=>page===1?first:[release('v1.26.0+build.5')]};
 }});
 const state=await controller.check({force:true});
 assert.equal(state.status,'UPDATE_AVAILABLE');
 assert.equal(state.release.version,'1.26.0+build.5');
});

test('truncated release listing never claims a complete successful check', async () => {
 let stored={},calls=0;
 const api={runtime:{getManifest:()=>({version:'1.24.1'})},storage:{local:{
  get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const full=Array.from({length:100},(_,i)=>release('v1.25.0-rc.'+(i+1),true));
 const controller=createUpdateController({api,fetchFn:async()=>{
  calls++;
  return {ok:true,status:200,json:async()=>full};
 }});
 const state=await controller.check();
 assert.equal(calls,5);
 assert.equal(state.status,'NOT_CHECKED');
 assert.equal(state.error,'CHECK_FAILED');
 assert.equal(state.lastSuccessAt,null);
});

test('pagination API rate limits preserve cooldown and do not claim no eligible releases', async () => {
 let stored={},page=0;
 const api={runtime:{getManifest:()=>({version:'1.24.1'})},storage:{local:{
  get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const first=Array.from({length:100},(_,i)=>release('v1.25.0-rc.'+(i+1),true));
 const controller=createUpdateController({api,fetchFn:async()=>{
  page++;
  return page===1 ? {ok:true,status:200,json:async()=>first} : {
   ok:false,status:429,headers:{get:()=> '120'}
  };
 }});
 const state=await controller.check();
 assert.equal(page,2);
 assert.equal(state.error,'RATE_LIMITED');
 assert.equal(state.status,'NOT_CHECKED');
 assert.ok(state.retryAfter>Date.now());
 await controller.check();
 assert.equal(page,2);
});

test('malformed later release pages cause retryable errors rather than incomplete success', async () => {
 let stored={},page=0;
 const api={runtime:{getManifest:()=>({version:'1.24.1'})},storage:{local:{
  get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const first=Array.from({length:100},(_,i)=>release('v1.25.0-rc.'+(i+1),true));
 const controller=createUpdateController({api,fetchFn:async()=>{
  page++;
  return {ok:true,status:200,json:async()=>page===1?first:{message:'bad response'}};
 }});
 const state=await controller.check();
 assert.equal(state.status,'NOT_CHECKED');
 assert.equal(state.error,'CHECK_FAILED');
 assert.equal(state.lastSuccessAt,null);
});

test('experimental preview is an optional same-manifest download, never a version upgrade', () => {
 const experimental = release('v1.24.2-preview.38826758140', true);
 assert.equal(selectRelease([experimental], '1.24.2', 'stable').status, 'UNSUPPORTED');
 const result = selectRelease([experimental], '1.24.2', 'preview');
 assert.equal(result.status, 'EXPERIMENTAL_AVAILABLE');
 assert.equal(selectRelease([experimental], '1.24.1', 'preview').status, 'PREVIEW_AVAILABLE');
 assert.equal(selectRelease([release('v1.24.1-preview.5', true)], '1.24.2', 'preview').status, 'INSTALLED_AHEAD');
 assert.equal(selectRelease([release('v1.24.2-rc.1', true)], '1.24.2', 'preview').status, 'INSTALLED_AHEAD');
 const time = Date.now();
 const state = sanitizeUpdateState({ enabled: true, channel: 'preview', checkedInstalled: '1.24.2',
   status: 'EXPERIMENTAL_AVAILABLE', lastSuccessAt: time,
   release: { ...result.release } }, '1.24.2');
 assert.equal(state.status, 'EXPERIMENTAL_AVAILABLE');
 assert.equal(state.release.url, result.release.url);
});

test('only official uploaded extension ZIP assets become download links', () => {
 const tag = 'v1.25.0';
 const name = 'btc-live-chromium-v1.25.0-candidate.zip';
 const url = 'https://github.com/jsmlabs/btc-live/releases/download/' + tag + '/' + name;
 const asset = {name, browser_download_url:url, size:125000, state:'uploaded'};
 const good = selectRelease([{...release(tag),assets:[asset]}], '1.24.2');
 assert.equal(good.status,'UPDATE_AVAILABLE');
 assert.equal(good.release.downloadUrl,url);
 const unsafe = selectRelease([{...release(tag),assets:[{...asset,browser_download_url:'https://example.org/injected.zip'}]}], '1.24.2');
 assert.equal(unsafe.release.downloadUrl,null);
 assert.equal(selectRelease([{...release(tag),assets:[{...asset,size:40_000_000}]}],'1.24.2').release.downloadUrl,null);
 assert.equal(selectRelease([{...release(tag),assets:[asset,asset]}],'1.24.2').release.downloadUrl,null);
 const time=Date.now();
 const state={channel:'stable',checkedInstalled:'1.24.2',lastSuccessAt:time,release:good.release};
 assert.equal(sanitizeUpdateState(state,'1.24.2').release.downloadUrl,url);
 state.release={...good.release,downloadUrl:'javascript:alert(1)'};
 assert.equal(sanitizeUpdateState(state,'1.24.2').release.downloadUrl,null);
});

test('checksum manifest must be the unique official release asset', () => {
 const tag = 'v1.25.0';
 const url = 'https://github.com/jsmlabs/btc-live/releases/download/' + tag + '/SHA256SUMS.txt';
 const zip = 'https://github.com/jsmlabs/btc-live/releases/download/' + tag + '/btc-live-chromium-v1.25.0-candidate.zip';
 const archive = {name:'btc-live-chromium-v1.25.0-candidate.zip',browser_download_url:zip,size:120000,state:'uploaded'};
 const sum = {name:'SHA256SUMS.txt',browser_download_url:url,size:96,state:'uploaded'};
 const choose = assets => selectRelease([{...release(tag),assets}],'1.24.2').release;
 assert.equal(choose([archive,sum]).checksumUrl,url);
 assert.equal(choose([archive]).checksumUrl,null);
 assert.equal(choose([archive,sum,sum]).checksumUrl,null);
 assert.equal(choose([archive,{...sum,browser_download_url:'https://evil.example/sums'}]).checksumUrl,null);
 assert.equal(choose([archive,{...sum,size:50000}]).checksumUrl,null);
 const state={channel:'stable',checkedInstalled:'1.24.2',lastSuccessAt:Date.now(),release:choose([archive,sum])};
 assert.equal(sanitizeUpdateState(state,'1.24.2').release.checksumUrl,url);
 state.release={...state.release,checksumUrl:'javascript:alert(1)'};
 assert.equal(sanitizeUpdateState(state,'1.24.2').release.checksumUrl,null);
});

test('installed-ahead status survives trusted cache sanitization', () => {
 const t=Date.now();
 const release={version:'1.24.1',url:'https://github.com/jsmlabs/btc-live/releases/tag/v1.24.1',prerelease:false};
 const state=sanitizeUpdateState({channel:'stable',checkedInstalled:'1.24.2',lastSuccessAt:t,release},'1.24.2');
 assert.equal(state.status,'INSTALLED_AHEAD');
 assert.equal(state.release.version,'1.24.1');
});

test('newer main manifest is separate from approved published releases', async () => {
 let stored={},urls=[];
 const api={runtime:{getManifest:()=>({version:'1.24.2'})},storage:{local:{
   get:async()=>stored,set:async x=>{stored={...stored,...x}}
 }}};
 const payload={type:'file',path:'manifest.json',encoding:'base64',content:btoa(JSON.stringify({manifest_version:3,version:'1.25.0'}))};
 const controller=createUpdateController({api,fetchFn:async url=>{
   urls.push(url);
   return {ok:true,status:200,json:async()=>url.includes('/contents/manifest.json')?payload:[]};
 }});
 const result=await controller.check({force:true});
 assert.equal(result.status,'DEVELOPMENT_AVAILABLE');
 assert.equal(result.developmentVersion,'1.25.0');
 assert.equal(result.release,null);
 assert.equal(urls.length,2);
 assert.ok(urls[1].endsWith('/contents/manifest.json?ref=main'));
 assert.equal((await controller.read()).status,'DEVELOPMENT_AVAILABLE');
 const invalid=sanitizeUpdateState({...result,developmentVersion:'9.0.0<script>'},'1.24.2');
 assert.equal(invalid.status,'NOT_CHECKED');
});
test('malformed development manifest never claims a software update', async () => {
 for (const payload of [
   {type:'file',path:'bad.json',encoding:'base64',content:btoa('{"manifest_version":3,"version":"9.0.0"}')},
   {type:'file',path:'manifest.json',encoding:'base64',content:btoa('invalid')},
   {type:'file',path:'manifest.json',encoding:'base64',content:btoa('{"manifest_version":2,"version":"9.0.0"}')}
 ]) {
   let stored={};
   const api={runtime:{getManifest:()=>({version:'1.24.2'})},storage:{local:{
     get:async()=>stored,set:async x=>{stored={...stored,...x}}
   }}};
   const controller=createUpdateController({api,fetchFn:async url=>({ok:true,status:200,json:async()=>url.includes('/contents/')?payload:[]})});
   const result=await controller.check();
   assert.equal(result.status,'UNSUPPORTED');
   assert.equal(result.developmentVersion,null);
 }
});
