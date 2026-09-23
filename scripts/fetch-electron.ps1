$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$vendor = Join-Path $root "vendor\electron"
$zip = Join-Path $root "vendor\electron-win.zip"
$url = "https://npmmirror.com/mirrors/electron/v36.9.5/electron-v36.9.5-win32-x64.zip"
New-Item -ItemType Directory -Force -Path (Join-Path $root "vendor") | Out-Null
Write-Host "Downloading Electron from npmmirror..."
curl.exe -L --retry 5 -o $zip $url
if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 1MB) { throw "Download failed" }
if (Test-Path $vendor) { Remove-Item -Recurse -Force $vendor }
Expand-Archive -Path $zip -DestinationPath $vendor -Force
Write-Host "OK: $vendor\electron.exe"
