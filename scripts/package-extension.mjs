import {readFile,readdir,mkdir,writeFile,lstat} from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtimeDirs=new Set(['app','background','dashboard','icons','market','popup','storage','ui','utils']);
const runtimeRootFiles=new Set(['manifest.json']);
const entries=[];
async function walk(dir=''){
 for(const item of await readdir(path.join(root,dir),{withFileTypes:true})){
  if(!dir && !runtimeDirs.has(item.name) && !runtimeRootFiles.has(item.name))continue;
  const relative=path.posix.join(dir,item.name),full=path.join(root,relative);
  const stat=await lstat(full);
  if(stat.isSymbolicLink())throw Error('Symbolic link rejected: '+relative);
  if(stat.isDirectory())await walk(relative);
  else if(stat.isFile())entries.push(relative);
 }
}
const crcTable=Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zip(files){
 const locals=[],directory=[];let offset=0;
 for(const [name,data] of files){
  const filename=Buffer.from(name,'utf8'),compressed=deflateRawSync(data,{level:9});
  if(filename.length>65535||data.length>0xffffffff||compressed.length>0xffffffff)throw Error('Oversized ZIP entry: '+name);
  const crc=crc32(data),local=Buffer.alloc(30),central=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);
  local.writeUInt16LE(0x21,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);
  central.writeUInt16LE(0x21,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(data.length,24);
  central.writeUInt16LE(filename.length,28);central.writeUInt32LE(0x81a40000,38);central.writeUInt32LE(offset,42);
  locals.push(local,filename,compressed);directory.push(central,filename);offset+=local.length+filename.length+compressed.length;
 }
 const size=directory.reduce((n,b)=>n+b.length,0);
 if(files.length>65535||offset>0xffffffff||size>0xffffffff||offset+size+22>0xffffffff)throw Error('ZIP64 is not supported');const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,...directory,end]);
}
if(!process.argv.includes('--skip-verify')){
 const verify=spawnSync(process.execPath,[path.join(root,'scripts/verify.mjs')],{stdio:'inherit'});
 if(verify.status!==0)process.exit(verify.status||1);
}
await walk();entries.sort((a,b)=>a<b?-1:a>b?1:0);
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
if(!entries.includes('manifest.json'))throw Error('Missing manifest in package');
if(entries.length<50)throw Error('Suspiciously small package: '+entries.length);
const files=await Promise.all(entries.map(async name=>[name,await readFile(path.join(root,name))]));
const bytes=zip(files);await mkdir(path.join(root,'dist'),{recursive:true});
const filename=`btc-live-chromium-v${manifest.version}-candidate.zip`;
await writeFile(path.join(root,'dist',filename),bytes);
console.log(`Created dist/${filename} (${files.length} files, ${bytes.length} bytes; sorted entries, fixed timestamps)`);
