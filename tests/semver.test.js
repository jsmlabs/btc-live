import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCommit,nextSemver} from '../scripts/semver.mjs';
test('Conventional Commit classification and breaking changes',()=>{
  assert.equal(classifyCommit('fix(liquidity): persistent tooltip'),'patch');
  assert.equal(classifyCommit('perf: reduce redraws'),'patch');
  assert.equal(classifyCommit('feat: add feature'),'minor');
  assert.equal(classifyCommit('feat(api)!: breaking'),'major');
  assert.equal(classifyCommit('refactor(core): change\n\nBREAKING CHANGE: API incompatible'),'major');
  assert.equal(classifyCommit('Merge pull request #1\n\nfeat: added'),'minor');
  for(const msg of ['docs: readme','test: suite','chore(release): auto-bump','not conventional']) assert.equal(classifyCommit(msg),null);
});
test('highest version increment wins and metadata-only commits do not bump',()=>{
  assert.equal(nextSemver('1.25.8',['fix: issue']),'1.25.9');
  assert.equal(nextSemver('1.25.8',['feat: new','fix: issue']),'1.26.0');
  assert.equal(nextSemver('1.25.8',['fix: issue','feat!: incompatible']),'2.0.0');
  assert.equal(nextSemver('1.25.8',['docs: description']),null);
  assert.throws(()=>nextSemver('v1.25.8',['fix: issue']),/Invalid current SemVer/);
});
