$ErrorActionPreference = "Stop"
$project = "D:\AI_Tools\Cursor\Cursor_Project\CGraph"
$icon = Join-Path $project "apps\desktop\assets\file-icon.ico"
if (-not (Test-Path $icon)) {
  $icon = Join-Path $project "apps\desktop\assets\file-icon.png"
}
$bat = Join-Path $project "scripts\launch-desktop.bat"
if (-not (Test-Path $icon)) { throw "Missing file icon: $icon" }

$progId = "CrystalloGraph.cgraph"
New-Item -Path "HKCU:\Software\Classes\.cgraph" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\.cgraph" -Name "(default)" -Value $progId
New-Item -Path "HKCU:\Software\Classes\$progId" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\$progId" -Name "(default)" -Value "CrystalloGraph Drawing"
New-Item -Path "HKCU:\Software\Classes\$progId\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\$progId\DefaultIcon" -Name "(default)" -Value "$icon,0"
New-Item -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Name "(default)" -Value "`"$bat`" `"%1`""
Write-Output "Registered .cgraph → $progId"
Write-Output "Icon: $icon"
