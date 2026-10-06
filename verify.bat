@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (
  echo ERROR: Node.js 20 or newer is required.
  exit /b 1
)
call npm.cmd run verify
exit /b %errorlevel%
