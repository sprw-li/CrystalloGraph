/**
 * Copy generated icons, strip near-white to alpha, build .ico for Windows shortcuts.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const assets = path.join(root, "apps", "desktop", "assets");
const genDir = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "d-AI-Tools-Cursor-Cursor-Project-CGraph",
  "assets",
);

const srcApp = path.join(genDir, "cgraph-app-icon-transparent.png");
const srcFile = path.join(genDir, "cgraph-file-icon-transparent.png");
const fallbackApp = path.join(genDir, "cgraph-app-icon.png");
const fallbackFile = path.join(genDir, "cgraph-file-icon.png");

fs.mkdirSync(assets, { recursive: true });
const appSrc = fs.existsSync(srcApp) ? srcApp : fallbackApp;
const fileSrc = fs.existsSync(srcFile) ? srcFile : fallbackFile;
if (!fs.existsSync(appSrc)) throw new Error("missing app icon source");
if (!fs.existsSync(fileSrc)) throw new Error("missing file icon source");

const tmpApp = path.join(assets, "_src_app.png");
const tmpFile = path.join(assets, "_src_file.png");
fs.copyFileSync(appSrc, tmpApp);
fs.copyFileSync(fileSrc, tmpFile);

const ps = `
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
function Strip-White([string]$inPath, [string]$outPath, [int]$threshold = 242) {
  $img = [System.Drawing.Image]::FromFile($inPath)
  $bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
  $g.Dispose(); $img.Dispose()
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -gt 0 -and $c.R -ge $threshold -and $c.G -ge $threshold -and $c.B -ge $threshold) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $c.R, $c.G, $c.B))
      }
    }
  }
  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
function Make-Ico([string]$pngPath, [string]$icoPath) {
  $img = [System.Drawing.Image]::FromFile($pngPath)
  $sizes = @(16, 32, 48, 256)
  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter $ms
  $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
  $frames = @()
  foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $s, $s)
    $g.Dispose()
    $pngMs = New-Object System.IO.MemoryStream
    $bmp.Save($pngMs, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $frames += ,@{ size = $s; bytes = $pngMs.ToArray() }
    $pngMs.Dispose()
  }
  $img.Dispose()
  $offset = 6 + (16 * $frames.Count)
  foreach ($f in $frames) {
    $sz = [int]$f.size
    $bw.Write([byte]$(if ($sz -ge 256) { 0 } else { $sz }))
    $bw.Write([byte]$(if ($sz -ge 256) { 0 } else { $sz }))
    $bw.Write([byte]0); $bw.Write([byte]0)
    $bw.Write([uint16]1); $bw.Write([uint16]32)
    $bw.Write([uint32]$f.bytes.Length); $bw.Write([uint32]$offset)
    $offset += $f.bytes.Length
  }
  foreach ($f in $frames) { $bw.Write($f.bytes) }
  $bw.Flush()
  if (Test-Path $icoPath) { Remove-Item $icoPath -Force }
  [System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
  $bw.Dispose(); $ms.Dispose()
}
$assets = '${assets.replace(/'/g, "''")}'
Strip-White (Join-Path $assets '_src_app.png') (Join-Path $assets 'icon.png')
Strip-White (Join-Path $assets '_src_file.png') (Join-Path $assets 'file-icon.png')
Make-Ico (Join-Path $assets 'icon.png') (Join-Path $assets 'icon.ico')
Make-Ico (Join-Path $assets 'file-icon.png') (Join-Path $assets 'file-icon.ico')
Remove-Item (Join-Path $assets '_src_app.png') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $assets '_src_file.png') -Force -ErrorAction SilentlyContinue
Write-Output 'icons ok'
`;

const psPath = path.join(assets, "_build_icons.ps1");
fs.writeFileSync(psPath, ps, "utf8");
execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psPath], {
  stdio: "inherit",
});
fs.unlinkSync(psPath);

// favicons
for (const dest of [
  path.join(root, "apps", "desktop", "public"),
  path.join(root, "apps", "web", "public"),
]) {
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(assets, "icon.png"), path.join(dest, "favicon.png"));
}
console.log("done", fs.readdirSync(assets));
