@echo off
setlocal DisableDelayedExpansion
title BTC Live - Safe Update
for %%I in ("%~dp0.") do set "ROOT=%%~fI"
echo.
echo BTC Live - Update from official GitHub main
echo Folder: "%ROOT%"
echo.
where git.exe >nul 2>&1
if errorlevel 1 goto nogit
git -C "%ROOT%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto noclone
set "TOPLEVEL="
for /f "delims=" %%T in ('git -C "%ROOT%" rev-parse --show-toplevel 2^>nul') do set "TOPLEVEL=%%~fT"
if not defined TOPLEVEL goto noclone
if /I not "%TOPLEVEL%"=="%ROOT%" goto wrongfolder
set "BRANCH="
for /f "delims=" %%B in ('git -C "%ROOT%" symbolic-ref --quiet --short HEAD 2^>nul') do set "BRANCH=%%B"
if /I not "%BRANCH%"=="main" goto wrongbranch
set "REMOTE="
for /f "delims=" %%R in ('git -C "%ROOT%" remote get-url origin 2^>nul') do set "REMOTE=%%R"
if /I "%REMOTE%"=="https://github.com/jsmlabs/btc-live.git" goto remoteok
if /I "%REMOTE%"=="https://github.com/jsmlabs/btc-live" goto remoteok
if /I "%REMOTE%"=="git@github.com:jsmlabs/btc-live.git" goto remoteok
echo ERROR: origin is not the expected BTC Live repository.
echo Origin: "%REMOTE%"
goto failed
:remoteok
git -C "%ROOT%" status --porcelain --untracked-files=all >nul
if errorlevel 1 goto failed
set "DIRTY="
for /f "delims=" %%S in ('git -C "%ROOT%" status --porcelain --untracked-files=all 2^>nul') do set "DIRTY=1"
if defined DIRTY goto dirty
set "BEFORE="
for /f "delims=" %%H in ('git -C "%ROOT%" rev-parse HEAD') do set "BEFORE=%%H"
if not defined BEFORE goto failed
echo Fetching official main...
git -C "%ROOT%" fetch --no-tags origin main
if errorlevel 1 goto failed
set "TARGET="
for /f "delims=" %%H in ('git -C "%ROOT%" rev-parse FETCH_HEAD 2^>nul') do set "TARGET=%%H"
if not defined TARGET goto failed
git -C "%ROOT%" merge-base --is-ancestor HEAD FETCH_HEAD
if errorlevel 1 goto diverged
echo Applying fast-forward update...
git -C "%ROOT%" merge --ff-only FETCH_HEAD
if errorlevel 1 goto failed
set "AFTER="
for /f "delims=" %%H in ('git -C "%ROOT%" rev-parse HEAD') do set "AFTER=%%H"
if not defined AFTER goto failed
if /I not "%AFTER%"=="%TARGET%" goto mismatch
if /I "%BEFORE%"=="%AFTER%" (
  echo.
  echo BTC Live files are already up to date.
) else (
  echo.
  echo BTC Live source updated successfully.
  echo Previous: %BEFORE%
  echo Current:  %AFTER%
)
echo.
echo NEXT: Click Reload for BTC Live at chrome://extensions
where chrome.exe >nul 2>&1
if not errorlevel 1 (
  start "" chrome.exe "chrome://extensions"
  goto done
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "chrome://extensions"
  goto done
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "chrome://extensions"
  goto done
)
echo Open chrome://extensions manually in your Chromium browser.
goto done
:nogit
echo ERROR: Git for Windows is missing or not on PATH.
echo Install Git from https://git-scm.com/downloads/win and retry.
goto failed
:noclone
echo ERROR: This directory is not a Git checkout.
echo Clone https://github.com/jsmlabs/btc-live.git and run this file in the cloned folder.
goto failed
:wrongfolder
echo ERROR: Run this updater from the root of the cloned repository.
echo Detected Git root: "%TOPLEVEL%"
goto failed
:wrongbranch
echo ERROR: The checkout is not on branch main.
echo Current branch: "%BRANCH%"
echo Switch branches yourself after preserving your changes.
goto failed
:diverged
echo ERROR: The local main branch cannot fast-forward to the fetched origin/main.
echo Your local commits are preserved. Inspect the branch history before retrying.
goto failed
:mismatch
echo ERROR: Git reported a different resulting commit than the fetched target.
echo Expected: %TARGET%
echo Actual:   %AFTER%
goto failed
:dirty
echo ERROR: Local changes or untracked files detected.
echo Resolve or back up your local changes before updating.
git -C "%ROOT%" status --short
goto failed
:failed
echo.
echo No successful update confirmed. The updater never performs a reset or force merge.
echo Inspect any Git error above. Do not reload until the issue is resolved.
pause
exit /b 1
:done
echo.
echo Files updated or confirmed current. Chromium must be reloaded manually.
pause
exit /b 0
