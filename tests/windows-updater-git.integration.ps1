$ErrorActionPreference = 'Continue' # Native Git progress on stderr is not a PowerShell exception; exit codes are checked.
$base = Join-Path ([IO.Path]::GetTempPath()) ('btc-live-updater-tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $base | Out-Null
function Invoke-RepoGit([string]$dir, [string[]]$commands) {
  $text = & git.exe -C $dir @commands 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Git $($commands -join ' ') failed: $text" }
  return ($text | Out-String).Trim()
}
function Commit([string]$path,[string]$version) {
  Set-Content -LiteralPath (Join-Path $path 'manifest.json') -Value ('{"manifest_version":3,"version":"' + $version + '"}') -Encoding ASCII
  $null = Invoke-RepoGit $path @('add','manifest.json')
  $null = Invoke-RepoGit $path @('-c','user.name=BTC Live Tests','-c','user.email=tests@example.invalid','commit','-m',"manifest $version")
}
function Check-Update([string]$path) {
  $branch = Invoke-RepoGit $path @('symbolic-ref','--quiet','--short','HEAD')
  if ($branch -cne 'main') { return 'WRONG_BRANCH' }
  $dirty = Invoke-RepoGit $path @('status','--porcelain','--untracked-files=all')
  if ($dirty) { return 'DIRTY' }
  $before = Invoke-RepoGit $path @('rev-parse','HEAD')
  $null = Invoke-RepoGit $path @('fetch','--no-tags','origin','main')
  $target = Invoke-RepoGit $path @('rev-parse','FETCH_HEAD')
  & git -C $path merge-base --is-ancestor HEAD FETCH_HEAD 2>$null
  if ($LASTEXITCODE -ne 0) { return 'DIVERGED' }
  $null = Invoke-RepoGit $path @('merge','--ff-only','FETCH_HEAD')
  $after = Invoke-RepoGit $path @('rev-parse','HEAD')
  if ($after -cne $target) { throw 'Verified HEAD differs from downloaded target' }
  if ($before -ceq $after) { return 'CURRENT' }
  return 'UPDATED'
}
try {
  $origin = Join-Path $base 'origin.git'
  $author = Join-Path $base 'author'
  $client = Join-Path $base 'client'
  $null = & git init --bare $origin 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create local origin' }
  $null = & git init -b main $author 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot initialize main' }
  Commit $author '1.0.0'
  $null = Invoke-RepoGit $author @('remote','add','origin',$origin)
  $null = Invoke-RepoGit $author @('push','-u','origin','main')
  $null = & git clone --branch main $origin $client 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create local clone' }
  if ((Check-Update $client) -ne 'CURRENT') { throw 'Already-current case failed' }
  Commit $author '1.0.1'
  $null = Invoke-RepoGit $author @('push','origin','main')
  if ((Check-Update $client) -ne 'UPDATED') { throw 'Fast-forward case failed' }
  if ((Check-Update $client) -ne 'CURRENT') { throw 'Idempotency case failed' }
  Set-Content -LiteralPath (Join-Path $client 'untracked.txt') -Value 'preserve'
  if ((Check-Update $client) -ne 'DIRTY') { throw 'Dirty checkout must be refused' }
  if (-not (Test-Path (Join-Path $client 'untracked.txt'))) { throw 'Untracked file lost' }
  Remove-Item -LiteralPath (Join-Path $client 'untracked.txt')
  $null = Invoke-RepoGit $client @('switch','-c','test-branch')
  if ((Check-Update $client) -ne 'WRONG_BRANCH') { throw 'Wrong branch must be refused' }
  $null = Invoke-RepoGit $client @('switch','main')
  Commit $client '1.0.2'
  Commit $author '1.0.3'
  $null = Invoke-RepoGit $author @('push','origin','main')
  $beforeDivergence = Invoke-RepoGit $client @('rev-parse','HEAD')
  if ((Check-Update $client) -ne 'DIVERGED') { throw 'Divergent branch must be refused' }
  if ((Invoke-RepoGit $client @('rev-parse','HEAD')) -cne $beforeDivergence) { throw 'Divergence altered local HEAD' }
  Write-Host 'PASS: current, fast-forward, idempotency, dirty, wrong branch, divergence; local history preserved'
} finally {
  if (Test-Path -LiteralPath $base) { Remove-Item -LiteralPath $base -Recurse -Force }
}
