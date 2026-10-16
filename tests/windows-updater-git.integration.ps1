$ErrorActionPreference = 'Stop'
$base = Join-Path ([IO.Path]::GetTempPath()) ('btc-live-updater-tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $base | Out-Null
function Git([string]$dir, [string[]]$commands) {
  $text = & git -C $dir @commands 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Git $($commands -join ' ') failed: $text" }
  return ($text | Out-String).Trim()
}
function Commit([string]$path,[string]$version) {
  Set-Content -LiteralPath (Join-Path $path 'manifest.json') -Value ('{"manifest_version":3,"version":"' + $version + '"}') -Encoding ASCII
  $null = Git $path @('add','manifest.json')
  $null = Git $path @('-c','user.name=BTC Live Tests','-c','user.email=tests@example.invalid','commit','-m',"manifest $version")
}
function Check-Update([string]$path) {
  $branch = Git $path @('symbolic-ref','--quiet','--short','HEAD')
  if ($branch -cne 'main') { return 'WRONG_BRANCH' }
  $dirty = Git $path @('status','--porcelain','--untracked-files=all')
  if ($dirty) { return 'DIRTY' }
  $before = Git $path @('rev-parse','HEAD')
  $null = Git $path @('fetch','--no-tags','origin','main')
  $target = Git $path @('rev-parse','FETCH_HEAD')
  & git -C $path merge-base --is-ancestor HEAD FETCH_HEAD 2>$null
  if ($LASTEXITCODE -ne 0) { return 'DIVERGED' }
  $null = Git $path @('merge','--ff-only','FETCH_HEAD')
  $after = Git $path @('rev-parse','HEAD')
  if ($after -cne $target) { throw 'Verified HEAD differs from downloaded target' }
  if ($before -ceq $after) { return 'CURRENT' }
  return 'UPDATED'
}
try {
  $origin = Join-Path $base 'origin.git'
  $author = Join-Path $base 'author'
  $client = Join-Path $base 'client'
  $null = & git init --bare $origin 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create local origin' }
  $null = & git init -b main $author 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Cannot initialize main' }
  Commit $author '1.0.0'
  $null = Git $author @('remote','add','origin',$origin)
  $null = Git $author @('push','-u','origin','main')
  $null = & git clone --branch main $origin $client 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create local clone' }
  if ((Check-Update $client) -ne 'CURRENT') { throw 'Already-current case failed' }
  Commit $author '1.0.1'
  $null = Git $author @('push','origin','main')
  if ((Check-Update $client) -ne 'UPDATED') { throw 'Fast-forward case failed' }
  if ((Check-Update $client) -ne 'CURRENT') { throw 'Idempotency case failed' }
  Set-Content -LiteralPath (Join-Path $client 'untracked.txt') -Value 'preserve'
  if ((Check-Update $client) -ne 'DIRTY') { throw 'Dirty checkout must be refused' }
  if (-not (Test-Path (Join-Path $client 'untracked.txt'))) { throw 'Untracked file lost' }
  Remove-Item -LiteralPath (Join-Path $client 'untracked.txt')
  $null = Git $client @('switch','-c','test-branch')
  if ((Check-Update $client) -ne 'WRONG_BRANCH') { throw 'Wrong branch must be refused' }
  $null = Git $client @('switch','main')
  Commit $client '1.0.2'
  Commit $author '1.0.3'
  $null = Git $author @('push','origin','main')
  $beforeDivergence = Git $client @('rev-parse','HEAD')
  if ((Check-Update $client) -ne 'DIVERGED') { throw 'Divergent branch must be refused' }
  if ((Git $client @('rev-parse','HEAD')) -cne $beforeDivergence) { throw 'Divergence altered local HEAD' }
  Write-Host 'PASS: current, fast-forward, idempotency, dirty, wrong branch, divergence; local history preserved'
} finally {
  if (Test-Path -LiteralPath $base) { Remove-Item -LiteralPath $base -Recurse -Force }
}
