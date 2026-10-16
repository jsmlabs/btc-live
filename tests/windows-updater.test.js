import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Windows CMD entrypoint launches only the bundled native updater', async () => {
 const script=await readFile(new URL('../Update BTC Live.cmd',import.meta.url),'utf8');
 assert.match(script,/setlocal DisableDelayedExpansion/);
 assert.match(script,/System32\\WindowsPowerShell\\v1\.0\\powershell\.exe/);
 assert.match(script,/-NoProfile -STA -ExecutionPolicy Bypass -File/);
 assert.match(script,/scripts\\update-btc-live\.ps1/);
 assert.match(script,/-RepoRoot "%~dp0"/);
 assert.doesNotMatch(script,/\b(?:git|curl|bitsadmin)\s+(?:fetch|pull|merge|reset|clone|download)\b/i);
});

test('native updater only fast-forwards official Git main with safeguards', async () => {
 const script=await readFile(new URL('../scripts/update-btc-live.ps1',import.meta.url),'utf8');
 for(const expected of [
  /Windows\.Forms\.Form/, /Windows\.Forms\.Timer/, /ReadToEndAsync/,
  /Get-Command git\.exe/, /rev-parse','--show-toplevel/,
  /symbolic-ref','--quiet','--short','HEAD/,
  /remote','get-url','origin/, /github\.com\/jsmlabs\/btc-live/,
  /status','--porcelain','--untracked-files=all/,
  /fetch','--no-tags','origin','main/,
  /merge-base','--is-ancestor','HEAD','FETCH_HEAD/,
  /merge','--ff-only','FETCH_HEAD/,
  /targetCommit/, /chrome:\/\/extensions/
 ]) assert.match(script,expected);
 assert.doesNotMatch(script,/\b(?:reset|stash|clean -fd|merge --no-ff|pull --rebase)\b/i);
 assert.match(script,/GIT_TERMINAL_PROMPT/);
 assert.match(script,/Operation timed out/);
});
