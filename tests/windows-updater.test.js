import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Windows BAT entrypoint launches only the bundled native updater', async () => {
 const script=await readFile(new URL('../update-btc-live.bat',import.meta.url),'utf8');
 assert.match(script,/setlocal DisableDelayedExpansion/);
 assert.match(script,/System32\\WindowsPowerShell\\v1\.0\\powershell\.exe/);
 assert.match(script,/-NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -File/);
 assert.match(script,/scripts\\update-btc-live\.ps1/);
 assert.match(script,/-RepoRoot "%~dp0"/);
 assert.match(script,/if not exist "%UPDATER%" goto missing_updater/);
 assert.match(script,/if not exist "%POWERSHELL%" goto missing_powershell/);
 assert.match(script,/set "RESULT=%ERRORLEVEL%"/);
 assert.match(script,/exit \/b 1/);
 assert.doesNotMatch(script,/^\s*(?:git|curl|bitsadmin)\s+(?:fetch|pull|merge|reset|clone|download)\b/im);
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
 assert.match(script,/Git operation timed out/);
});

test('GUI cannot close or time out during repository-changing fast-forward', async () => {
 const script=await readFile(new URL('../scripts/update-btc-live.ps1',import.meta.url),'utf8');
 assert.match(script,/Args=@\('merge','--ff-only','FETCH_HEAD'\); Label='Applying safe update'; Timeout=0/);
 assert.match(script,/Timeout -gt 0 -and \$watch\.ElapsedMilliseconds/);
 assert.match(script,/\$form\.Add_FormClosing/);
 assert.match(script,/\$e\.Cancel=\$true/);
 assert.match(script,/Update in progress\. Please wait/);
 assert.match(script,/\$current\.version -ne \$targetVersion/);
 assert.match(script,/\$form\.AcceptButton=\$update/);
});

test('timeout cannot permit a retry while Git is still alive', async () => {
 const script=await readFile(new URL('../scripts/update-btc-live.ps1',import.meta.url),'utf8');
 assert.match(script,/\$script:timedOut=\$true/);
 assert.match(script,/if\(\$timedOut\)\{Fail 'Git operation timed out/);
 assert.match(script,/\$process\.Dispose\(\)\s+\$script:process=\$null\s+if\(\$timedOut\)/);
 assert.match(script,/\$progress\.Value=0/);
 assert.match(script,/if\(\$current\.manifest_version -ne 3 -or \$current\.version -ne \$targetVersion\)/);
});

test('updater serializes execution per checkout and resets stale state', async () => {
 const source=await readFile(new URL('../scripts/update-btc-live.ps1',import.meta.url),'utf8');
 assert.match(source,/New-Object Threading\.Mutex/);
 assert.match(source,/\$instanceLock\.WaitOne\(0\)/);
 assert.match(source,/\$instanceLock\.ReleaseMutex\(\)/);
 assert.match(source,/\$script:oldCommit=''/);
 assert.match(source,/\$script:targetCommit=''/);
 assert.match(source,/\$browser\.Enabled=\$false/);
});
test('update panel never recommends deleted CMD launcher', async () => {
 const panel=await readFile(new URL('../ui/software-update-panel.js',import.meta.url),'utf8');
 assert.match(panel,/update-btc-live\.bat/);
 assert.doesNotMatch(panel,/Update BTC Live\.cmd/);
});
