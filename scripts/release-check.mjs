import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
assert(manifest.manifest_version===3,'Manifest V3 required');
assert(manifest.version==='1.25.2','Unexpected manifest version, review release metadata');
const packageInfo=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
assert(packageInfo.private===true && packageInfo.name==='btc-live' && packageInfo.version===manifest.version,'Package and manifest version drift');
const allowedPermissions=new Set(['storage','notifications','alarms']);
assert(Array.isArray(manifest.permissions)&&manifest.permissions.length===allowedPermissions.size&&new Set(manifest.permissions).size===allowedPermissions.size&&manifest.permissions.every(x=>allowedPermissions.has(x)),'Unexpected or missing extension permission');
assert(JSON.stringify(manifest.host_permissions)==='["https://fapi.binance.com/*","https://api.github.com/*"]','Host permission drift');
const csp=manifest.content_security_policy?.extension_pages??'';
assert(csp.includes("script-src 'self'")&&!/unsafe-eval|unsafe-inline|https?:[^ ]+\/.*script/i.test(csp),'CSP not sufficiently restricted');
assert(manifest.background?.type==='module','Unexpected worker type');
assert(!manifest.content_scripts && !manifest.externally_connectable && !manifest.web_accessible_resources,'Unexpected extension exposure');
assert(csp==="script-src 'self'; object-src 'self'; connect-src https://api.github.com https://fapi.binance.com wss://fstream.binance.com",'Unexpected CSP drift');
const runtimeDirs=new Set(['app','background','dashboard','icons','market','popup','storage','ui','utils']);
const extension=['manifest.json'];
async function walk(dir){
 for(const e of await readdir(dir,{withFileTypes:true})){
  const absolute=path.join(dir,e.name);
  if(e.isSymbolicLink())throw Error('Symlinks not supported: '+absolute);
  if(e.isDirectory())await walk(absolute);
  else if(e.isFile())extension.push(path.relative(root,absolute).split(path.sep).join('/'));
  else throw Error('Unsupported runtime directory entry: '+absolute);
 }
}
for(const dir of runtimeDirs)await walk(path.join(root,dir));

assert(extension.length>50,'Unexpectedly small extension');
const files=new Set(extension);
assert(files.size===extension.length,'Duplicate runtime file path detected');
for(const rel of extension)assert(rel==='manifest.json'||rel.split('/')[0]&&runtimeDirs.has(rel.split('/')[0]),'Unexpected package root: '+rel);
const entry=[manifest.action?.default_popup,manifest.background?.service_worker,...Object.values(manifest.icons??{}),...Object.values(manifest.action?.default_icon??{})];
for(const f of entry)assert(files.has(f),'Missing extension entry: '+f);
for(const htmlFile of extension.filter(f=>f.endsWith('.html'))){const html=await readFile(path.join(root,htmlFile),'utf8');for(const m of html.matchAll(/\b(?:src|href)\s*=\s*(["'])([^"']+)\1/g)){const ref=m[2];if(/^(?:https?:|data:|#|mailto:)/.test(ref))continue;const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(htmlFile),ref.split(/[?#]/)[0]));assert(files.has(resolved),`Missing local asset ${htmlFile}: ${ref}`)}}
for(const rel of extension){const s=await stat(path.join(root,rel));assert(s.size<=4*1024*1024,`Unexpected oversized extension asset: ${rel}`)}
console.log(`Release checks passed: ${extension.length} runtime files, permissions/CSP/HTML resources verified; manifest ${manifest.version}.`);
