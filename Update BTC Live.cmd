@echo off
setlocal DisableDelayedExpansion
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" (
  echo Windows PowerShell 5.1 is required to launch BTC Live Updater.
  pause
  exit /b 1
)
"%PS%" -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0scripts\update-btc-live.ps1" -RepoRoot "%~dp0"
if errorlevel 1 (
  echo BTC Live Updater could not start or exited with an error.
  pause
  exit /b 1
)
exit /b 0
