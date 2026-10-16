@echo off
setlocal DisableDelayedExpansion
title BTC Live Updater

rem Native Windows entrypoint. Update logic and GUI live in the bundled PowerShell file.
set "UPDATER=%~dp0scripts\update-btc-live.ps1"
set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%UPDATER%" goto missing_updater
if not exist "%POWERSHELL%" goto missing_powershell

"%POWERSHELL%" -NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -File "%UPDATER%" -RepoRoot "%~dp0."
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" goto launch_failed
exit /b 0

:missing_updater
echo.
echo BTC Live Updater could not find its bundled PowerShell component.
echo Please run this file from a complete Git clone of jsmlabs/btc-live.
goto error

:missing_powershell
echo.
echo Windows PowerShell 5.1 could not be found.
echo Windows 10 or 11 with the built-in Windows PowerShell is required.
goto error

:launch_failed
echo.
echo BTC Live Updater stopped with exit code %RESULT%.
echo No successful browser update has been confirmed.
goto error

:error
echo.
echo No automatic reset or overwrite will be attempted by this launcher.
pause
exit /b 1
