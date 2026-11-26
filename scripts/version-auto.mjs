import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {nextSemver, classifyCommit} from './semver.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');
const write = (file, text) => writeFile(path.join(root, file), text, 'utf8');
const version = JSON.parse(await read('manifest.json')).version;
if (version !== JSON.parse(await read('package.json')).version) throw Error('Manifest/package drift');
const baseline = execFileSync('git', ['log', '-1', '--format=%H', 'HEAD', '--', 'manifest.json'], {cwd:root,encoding:'utf8'}).trim();
if (!/^[0-9a-f]{40}$/.test(baseline)) throw Error('Missing manifest baseline');
const raw = execFileSync('git', ['log','--no-merges','--format=%B%x1e',baseline+'..HEAD'], {cwd:root,encoding:'utf8'});
const commits = raw.split('\x1e').map(item => item.trim()).filter(Boolean);
const next = nextSemver(version, commits);
if (!next) { console.log('SemVer: no relevant Conventional Commits; unchanged.'); process.exit(0); }
async function update(file, transform) {
  const old = await read(file), updated = transform(old);
  if (old === updated) throw Error('Version metadata not found: ' + file);
  await write(file, updated);
}
async function jsonVersion(file,key) {
  const escaped=version.replace(/\./g,'\\.');
  await update(file, text => text.replace(new RegExp('("'+key+'"\\s*:\\s*")'+escaped+'(")'), (_m,a,b)=>a+next+b));
}
await jsonVersion('manifest.json','version');
await jsonVersion('package.json','version');
await jsonVersion('docs/release-acceptance.json','manifest_version');
await update('README.md', text=>text.replaceAll(version,next));
const tick=String.fromCharCode(96);
for(const file of ['docs/ARCHITECTURE.md','docs/USAGE.md'])
  await update(file,text=>text.replace('manifest '+tick+version+tick,'manifest '+tick+next+tick));
await update('docs/RELEASE.md',text=>{
  const heading='## Development-candidate changes in '+version;
  if(!text.includes(heading))throw Error('Release version heading missing');
  const replacement=['## Development-candidate changes in '+next,'',
    '- Automatic Conventional Commit SemVer bump; see CHANGELOG.md for included changes.',
    '- The seven manual release gates remain pending; this is not a stable publication.','',heading].join('\n');
  return text.replace(heading,replacement)
    .replace('manifest.json'+tick+' reports '+tick+version+tick,'manifest.json'+tick+' reports '+tick+next+tick)
    .replaceAll('btc-live-chromium-v'+version+'-candidate.zip','btc-live-chromium-v'+next+'-candidate.zip');
});
await update('CHANGELOG.md',text=>{
  const heading='## Unreleased',at=text.indexOf(heading),after=text.indexOf('\n## [',at+heading.length);
  if(at<0||after<0)throw Error('Changelog missing Unreleased section');
  const pending=text.slice(at+heading.length,after).trim();
  const subjects=[...new Set(commits.filter(classifyCommit).map(x=>x.split(/\r?\n/)[0].trim()))];
  const entry=['## Unreleased','','## ['+next+'] - '+new Date().toISOString().slice(0,10),'',
    '### Conventional Commits',...(subjects.length?subjects.map(x=>'- '+x):['- Maintenance changes']),
    ...(pending?['',pending]:[]),''].join('\n');
  return text.slice(0,at)+entry+text.slice(after);
});
console.log('SemVer '+version+' -> '+next+' ('+commits.length+' commits since '+baseline.slice(0,7)+').');
