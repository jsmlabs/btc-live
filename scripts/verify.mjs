import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exclusions=new Set(['node_modules','.git','dist']);
const syntaxTimeoutMs=10_000;
const testTimeoutMs=20_000;
async function walk(dir){
 const result=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(exclusions.has(e.name))continue;
  const p=path.join(dir,e.name);
  if(e.isSymbolicLink())throw Error('Symbolic link in verification tree: '+p);
  if(e.isDirectory())result.push(...await walk(p));
  else if(e.isFile())result.push(p);
  else throw Error('Unsupported filesystem entry: '+p);
 }
 return result;
}
const files=await walk(root);
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
if(manifest.manifest_version!==3||!/^\d+\.\d+\.\d+$/.test(manifest.version))throw Error('Unexpected extension manifest');
const entries=[manifest.action?.default_popup,manifest.background?.service_worker,...Object.values(manifest.icons??{})];
for(const p of entries)if(!files.includes(path.join(root,p)))throw Error('Missing manifest entry '+p);
let imports=0;
for(const f of files.filter(p=>p.endsWith('.js')||p.endsWith('.mjs'))){
 const result=spawnSync(process.execPath,['--check',f],{encoding:'utf8',timeout:syntaxTimeoutMs});
 if(result.error||result.status!==0)throw Error(`Syntax check failed ${path.relative(root,f)}: ${result.error?.message??result.stderr}`);
 const source=await readFile(f,'utf8');
 const re=/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g;
 for(const m of source.matchAll(re)){
  const resolved=path.resolve(path.dirname(f),m[1]);
  if(!files.includes(resolved))throw Error(`Missing import ${m[1]} from ${path.relative(root,f)}`);
  imports++;
 }
}
for(const f of ['popup/popup.html','dashboard/dashboard.html']){
 const html=await readFile(path.join(root,f),'utf8');
 for(const m of html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)){
  if(!files.includes(path.resolve(root,path.dirname(f),m[1])))throw Error('Missing HTML script '+m[1]);
 }
}
console.log(`Manifest ${manifest.version}: ${files.length} files, ${files.filter(f=>f.endsWith('.js')||f.endsWith('.mjs')).length} checked scripts, ${imports} relative imports validated.`);
const testFiles=files.filter(f=>f.startsWith(path.join(root,'tests')+path.sep)&&f.endsWith('.test.js')).sort();
if(!testFiles.length)throw Error('No test files found');
let failures=0;
for(const file of testFiles){
 const relative=path.relative(root,file);
 console.log(`Running ${relative}`);
 const run=spawnSync(process.execPath,['--test',file],{stdio:'inherit',timeout:testTimeoutMs});
 if(run.error||run.status!==0){
  failures++;
  console.error(`FAILED ${relative}: ${run.error?.message??`exit ${run.status}`}`);
 }
}
console.log(`Test files: ${testFiles.length}; failed: ${failures}`);
if(failures)process.exitCode=1;
