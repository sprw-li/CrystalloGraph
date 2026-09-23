# CrystalloGraph

Interactive drawing tool for the **17 plane crystallographic groups** (wallpaper groups): unique editable master layer, polar stroke input, and `.cgraph` project files.

对称绘画工具：17 种壁纸空间群、主框图唯一可编辑图层、极径/极角落笔、`.cgraph` 工程文件。

## Structure

```
packages/core   shared core (symmetry, canvas, state, i18n, .cgraph)
apps/web        web shell (draw + save)
apps/desktop    Electron desktop (Windows-first)
```

## Quick start (web)

```bash
npm install
npm run dev:web        # http://localhost:5173
```

## Desktop (optional)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fetch-electron.ps1
npm run dev:desktop
```

`vendor/electron` is **not** in git — fetch it with the script above (or use the web app only).

```bash
npm run shortcut       # create desktop CrystalloGraph.lnk
```

Or double-click `scripts/launch-desktop.bat`.

## Features

- Cell parameters a / b / θ with 17-group switching and constraints
- Preview group change while dragging parameters; optional group lock
- Master-layer drawing (pencil / eraser / line / rect / ellipse / brush)
- Symmetry replicas, special-point snap, display modes
- Open / save `.cgraph`; zh/en UI

## License

MIT
