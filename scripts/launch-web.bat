@echo off
cd /d "%~dp0.."
title CrystalloGraph Web
echo Starting CrystalloGraph web on http://127.0.0.1:5173 ...
node scripts\dev-web.mjs
if errorlevel 1 pause
