$ErrorActionPreference = "Stop"
$project = "D:\AI_Tools\Cursor\Cursor_Project\CGraph"
$bat = Join-Path $project "scripts\launch-desktop.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
if (-not $desktop -or -not (Test-Path $desktop)) { $desktop = "D:\Desktop" }
$lnkPath = Join-Path $desktop "CrystalloGraph.lnk"

$w = New-Object -ComObject WScript.Shell
$shortcut = $w.CreateShortcut($lnkPath)
$shortcut.TargetPath = $bat
$shortcut.WorkingDirectory = $project
$shortcut.WindowStyle = 1
$shortcut.Description = "CrystalloGraph Desktop"
$icon = Join-Path $project "apps\desktop\assets\icon.ico"
if (-not (Test-Path $icon)) {
  $icon = Join-Path $project "apps\desktop\assets\icon.png"
}
if (-not (Test-Path $icon)) {
  $icon = Join-Path $project "vendor\electron\electron.exe"
}
# Windows shortcuts need .ico for reliable display
$shortcut.IconLocation = "$icon,0"
$shortcut.Save()

Write-Output "Created: $lnkPath"
Write-Output "Icon: $icon"
