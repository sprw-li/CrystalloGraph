@echo off
cd /d "%~dp0.."
title CrystalloGraph
echo Starting CrystalloGraph desktop...
echo (Desktop UI is served on port 5174+, not 5173)
node scripts\dev-desktop.mjs
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo Launch failed with code %ERR%.
  pause
)
exit /b %ERR%
