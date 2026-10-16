param([Parameter(Mandatory=$true)][string]$RepoRoot)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$root=[IO.Path]::GetFullPath($RepoRoot).TrimEnd('\')
# A per-checkout mutex prevents competing updater windows from modifying the same checkout.
$bytes=[Text.Encoding]::UTF8.GetBytes($root.ToUpperInvariant())
$hash=[Security.Cryptography.SHA256]::Create()
try { $key=[BitConverter]::ToString($hash.ComputeHash($bytes)).Replace('-','') } finally { $hash.Dispose() }
$instanceLock=New-Object Threading.Mutex($false,('Local\BTCLiveUpdater-'+$key))
$ownsLock=$false
try { $ownsLock=$instanceLock.WaitOne(0) }
catch [Threading.AbandonedMutexException] { $ownsLock=$true }
if(-not $ownsLock) {
 [Windows.Forms.MessageBox]::Show('BTC Live Updater is already running for this folder. Finish that update before trying again.','BTC Live Updater','OK','Information') | Out-Null
 $instanceLock.Dispose()
 exit 2
}

$manifestPath=Join-Path $root 'manifest.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if($manifest.manifest_version -ne 3){throw 'Invalid local manifest'}
$form=New-Object Windows.Forms.Form
$form.Text='BTC Live | Updater'
$form.AccessibleName='BTC Live safe source updater'
$form.Size=New-Object Drawing.Size(540,355)
$form.MinimumSize=New-Object Drawing.Size(510,355)
$form.StartPosition='CenterScreen'
$form.BackColor=[Drawing.Color]::FromArgb(19,25,36)
$form.ForeColor=[Drawing.Color]::White
$form.Font=New-Object Drawing.Font('Segoe UI',10)
$form.AutoScaleMode='Dpi'
$form.MaximizeBox=$false
function Add-Label($text,$y,$height,$size,$muted){
 $l=New-Object Windows.Forms.Label
 $l.Text=$text
 $l.Location=New-Object Drawing.Point(28,$y)
 $l.Size=New-Object Drawing.Size(475,$height)
 $l.Font=New-Object Drawing.Font('Segoe UI',$size)
 if($muted){$l.ForeColor=[Drawing.Color]::FromArgb(153,170,191)}
 $form.Controls.Add($l)
 return $l
}
$null=Add-Label 'BTC LIVE' 22 42 22 $false
$null=Add-Label 'One-click development source update' 67 25 10 $true
$versions=Add-Label "Installed: $($manifest.version)    |    Available: not checked" 112 28 10 $false
$status=Add-Label 'Ready to check for updates.' 150 44 10 $false
$progress=New-Object Windows.Forms.ProgressBar
$progress.Location=New-Object Drawing.Point(28,205)
$progress.Size=New-Object Drawing.Size(475,5)
$form.Controls.Add($progress)
$update=New-Object Windows.Forms.Button
$update.Text='&Update BTC Live'
$update.Location=New-Object Drawing.Point(28,231)
$update.Size=New-Object Drawing.Size(215,42)
$update.BackColor=[Drawing.Color]::FromArgb(49,120,238)
$update.ForeColor=[Drawing.Color]::White
$update.FlatStyle='Flat'
$update.FlatAppearance.BorderSize=0
$form.Controls.Add($update)
$form.AcceptButton=$update
$browser=New-Object Windows.Forms.Button
$browser.Text='Open browser &extensions'
$browser.Location=New-Object Drawing.Point(255,231)
$browser.Size=New-Object Drawing.Size(248,42)
$browser.Enabled=$false
$form.Controls.Add($browser)
$null=Add-Label 'After updating, click Reload in chrome://extensions.' 287 28 9 $true
$git=Get-Command git.exe -ErrorAction SilentlyContinue
$gitExe=if($git){$git.Source}else{$null}
$running=$false
$step=0
$process=$null
$outTask=$null
$errTask=$null
$watch=$null
$timedOut=$false
$oldCommit=''
$targetCommit=''
$targetVersion=''
$steps=@(
 @{ Args=@('rev-parse','--show-toplevel'); Label='Checking checkout'; Timeout=15000 },
 @{ Args=@('symbolic-ref','--quiet','--short','HEAD'); Label='Checking branch'; Timeout=15000 },
 @{ Args=@('remote','get-url','origin'); Label='Checking repository origin'; Timeout=15000 },
 @{ Args=@('status','--porcelain','--untracked-files=all'); Label='Checking local changes'; Timeout=15000 },
 @{ Args=@('rev-parse','HEAD'); Label='Reading installed commit'; Timeout=15000 },
 @{ Args=@('fetch','--no-tags','origin','main'); Label='Fetching latest source'; Timeout=90000 },
 @{ Args=@('rev-parse','FETCH_HEAD'); Label='Reading fetched commit'; Timeout=15000 },
 @{ Args=@('show','FETCH_HEAD:manifest.json'); Label='Reading available version'; Timeout=15000 },
 @{ Args=@('merge-base','--is-ancestor','HEAD','FETCH_HEAD'); Label='Verifying fast-forward'; Timeout=15000 },
 @{ Args=@('merge','--ff-only','FETCH_HEAD'); Label='Applying safe update'; Timeout=0 },
 @{ Args=@('rev-parse','HEAD'); Label='Confirming resulting commit'; Timeout=15000 }
)
function Set-Status([string]$message,[bool]$errorState=$false){
 $status.Text=$message
 $status.ForeColor=if($errorState){[Drawing.Color]::FromArgb(255,148,143)}else{[Drawing.Color]::White}
}
$timer=New-Object Windows.Forms.Timer
$timer.Interval=120
function Fail([string]$message){
 $script:running=$false
 $timer.Stop()
 $progress.Style='Blocks'
 $progress.Value=0
 $browser.Enabled=$false
 $update.Enabled=$true
 $update.Text='Retry update'
 Set-Status $message $true
}
function Start-Step{
 if($step -ge $steps.Count){
   $timer.Stop()
   $progress.Style='Blocks'
     try { $current=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json }
   catch { Fail 'Git completed but the local extension manifest could not be read.'; return }
   if($current.manifest_version -ne 3 -or $current.version -ne $targetVersion){Fail 'Local manifest does not match the verified target version.';return}
   $script:running=$false
   $progress.Value=100
   $update.Enabled=$true
   $update.Text='Check again'
   $browser.Enabled=$true
   $versions.Text="Installed: $($current.version)    |    Available: $targetVersion"
   if($oldCommit -eq $targetCommit){Set-Status ('Already current. Commit '+$targetCommit.Substring(0,12))}
   else{Set-Status ('Source updated to '+$targetCommit.Substring(0,12)+'. Reload in Chrome.')}
   if($oldCommit -ne $targetCommit){$browser.PerformClick()}
   return
 }
 $item=$steps[$step]
 Set-Status $item.Label
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=$gitExe
 $info.WorkingDirectory=$root
 $info.UseShellExecute=$false
 $info.CreateNoWindow=$true
 $info.RedirectStandardOutput=$true
 $info.RedirectStandardError=$true
 $info.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0'
 $info.EnvironmentVariables['GCM_INTERACTIVE']='Never'
 $info.Arguments=[string]::Join(' ',[string[]]$item.Args)
 $script:process=New-Object Diagnostics.Process
 $process.StartInfo=$info
 if(-not $process.Start()){throw 'Unable to launch Git'}
 $script:outTask=$process.StandardOutput.ReadToEndAsync()
 $script:errTask=$process.StandardError.ReadToEndAsync()
 $script:watch=[Diagnostics.Stopwatch]::StartNew()
 $script:timedOut=$false
}
function Check-Result([int]$exit,[string]$output){
 $value=$output.Trim()
 if($exit -ne 0){
   if($step -eq 8){Fail 'Branch diverged; local commits were preserved.'}
   elseif($step -eq 5){Fail 'Download failed. Check your internet connection.'}
   else{Fail "Git failed during: $($steps[$step].Label)"}
   return
 }
 switch($step){
   0 { $actual=[IO.Path]::GetFullPath($value.Replace('/','\')).TrimEnd('\')
       if($actual -ine $root){Fail 'Not the root of this Git checkout.';return} }
   1 { if($value -cne 'main'){Fail 'Checkout must be on main.';return} }
   2 { if($value -cnotin @('https://github.com/jsmlabs/btc-live.git','https://github.com/jsmlabs/btc-live','git@github.com:jsmlabs/btc-live.git')){
         Fail 'Origin is not the official BTC Live repository.';return } }
   3 { if($value){Fail 'Local changes found. Commit or back them up first.';return} }
   4 { if($value -notmatch '^[a-f0-9]{40,64}$'){Fail 'Invalid HEAD commit.';return};$script:oldCommit=$value }
   6 { if($value -notmatch '^[a-f0-9]{40,64}$'){Fail 'Invalid fetched commit.';return};$script:targetCommit=$value }
   7 { try{$remote=$value | ConvertFrom-Json
           if($remote.manifest_version -ne 3 -or $remote.version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid manifest'}
           # Refuse rollback even when the new commit is a Git fast-forward.
           if($manifest.version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid installed version'}
           $installed=[version]::Parse([string]$manifest.version)
           $available=[version]::Parse([string]$remote.version)
           if($available -lt $installed){Fail 'Fetched source has an older version. No files changed.';return}
           $script:targetVersion=$remote.version
           $versions.Text="Installed: $($manifest.version)    |    Available: $targetVersion"
       }catch{Fail 'Downloaded manifest is invalid.';return} }
   10 { if($value -cne $targetCommit){Fail 'Resulting commit differs from fetched target.';return} }
 }
 $script:step++
 try{Start-Step}catch{Fail ('Git execution error: '+$_.Exception.Message)}
}
$timer.Add_Tick({
 if(-not $running -or $null -eq $process){return}
 if(-not $process.HasExited){
   if(-not $timedOut -and [int]$steps[$step].Timeout -gt 0 -and $watch.ElapsedMilliseconds -gt [int]$steps[$step].Timeout){
     $script:timedOut=$true
     Set-Status 'Stopping a timed-out Git operation...' $true
     try{$process.Kill()}catch{}
   }
   return
 }
 if(-not $outTask.IsCompleted -or -not $errTask.IsCompleted){return}
 try{
   $exit=$process.ExitCode
   $output=$outTask.GetAwaiter().GetResult()
   $null=$errTask.GetAwaiter().GetResult()
   $process.Dispose()
   $script:process=$null
   if($timedOut){Fail 'Git operation timed out. Check your connection and retry.';return}
   Check-Result $exit $output
 }catch{Fail ('Unable to verify result: '+$_.Exception.Message)}
})
$update.Add_Click({
 if($running){return}
 if(-not $gitExe){Fail 'Git for Windows is missing. Install Git and retry.';return}
 $script:step=0
 $script:oldCommit=''
 $script:targetCommit=''
 $script:targetVersion=''
 $script:running=$true
 $update.Enabled=$false
 $browser.Enabled=$false
 $progress.Style='Marquee'
 $progress.MarqueeAnimationSpeed=25
 try{Start-Step;$timer.Start()}catch{Fail ('Unable to start: '+$_.Exception.Message)}
})
$browser.Add_Click({
 $candidates=@()
 if($env:ProgramFiles){$candidates+=Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'}
 $x86=[Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
 if($x86){$candidates+=Join-Path $x86 'Google\Chrome\Application\chrome.exe'}
 $chrome=$candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
 if($chrome){
   try { Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions' -ErrorAction Stop }
   catch { Set-Status 'Open chrome://extensions manually.' }
 } else { Set-Status 'Open chrome://extensions manually.' }
})
$form.Add_FormClosing({
 param($sender,$e)
 if($running){
   $e.Cancel=$true
   Set-Status 'Update in progress. Please wait until Git has finished.'
   return
 }
 $timer.Stop()
 if($process){try{$process.Dispose()}catch{}}
})
if(-not $gitExe){Set-Status 'Git for Windows is missing. Install it first.' $true}
try { [void]$form.ShowDialog() }
finally { if($ownsLock){$instanceLock.ReleaseMutex()};$instanceLock.Dispose();$form.Dispose() }
