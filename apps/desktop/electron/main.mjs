import { app, BrowserWindow, nativeImage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// When launched via vendor electron.exe with apps/desktop as cwd,
// package.json "main" points here. Dev URL is preferred.
const DEV_URL = process.env.CGRAPH_DEV_URL || "http://localhost:5174";
const ICON_PATH = path.join(__dirname, "..", "assets", "icon.ico");
const ICON_PNG = path.join(__dirname, "..", "assets", "icon.png");

function createWindow() {
  let icon = nativeImage.createFromPath(ICON_PATH);
  if (icon.isEmpty()) icon = nativeImage.createFromPath(ICON_PNG);
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    title: "CrystalloGraph",
    backgroundColor: "#ffffff",
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void win.loadURL(DEV_URL);
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.crystallograph.app");
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
