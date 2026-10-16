import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('one-click Windows updater preserves local changes and fast-forward-only semantics', async () => {
 const script=await readFile(new URL('../Update BTC Live.cmd', import.meta.url),'utf8');
 assert.match(script,/setlocal DisableDelayedExpansion/);
 assert.match(script,/where git\.exe/);
 assert.match(script,/symbolic-ref --quiet --short HEAD/);
 assert.match(script,/remote get-url origin/);
 assert.match(script,/github\.com\/jsmlabs\/btc-live/);
 assert.match(script,/status --porcelain --untracked-files=all/);
 assert.match(script,/if defined DIRTY goto dirty/);
 assert.match(script,/rev-parse --show-toplevel/);
 assert.match(script,/fetch --no-tags origin main/);
 assert.match(script,/merge-base --is-ancestor HEAD FETCH_HEAD/);
 assert.match(script,/merge --ff-only FETCH_HEAD/);
 assert.match(script,/if \/I not "%AFTER%"=="%TARGET%" goto mismatch/);
 assert.match(script,/:diverged/);
 assert.match(script,/:wrongfolder/);
 assert.match(script,/rev-parse HEAD/g);
 assert.match(script,/chrome:\/\/extensions/);
 assert.doesNotMatch(script,/git\s+(?:reset|clean|stash|push)\b/i);
 assert.doesNotMatch(script,/\b(?:merge --no-ff|pull --rebase|fetch --tags)\b/i);
 assert.doesNotMatch(script,/curl|Invoke-WebRequest|powershell -enc/i);
});
