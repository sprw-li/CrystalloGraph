import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import fs from "node:fs";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const electronExe = path.join(root, "vendor", "electron", "electron.exe");
const desktopDir = path.join(root, "apps", "desktop");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const preferredPort = Number(process.env.CGRAPH_PORT || 5174);

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function killPortWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        console.log(`Freed port ${port} (killed PID ${pid})`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* nothing listening */
  }
}

async function pickPort(start) {
  for (let p = start; p < start + 20; p++) {
    if (await isPortFree(p)) return p;
    console.log(`Port ${p} busy, trying to free...`);
    killPortWindows(p);
    await new Promise((r) => setTimeout(r, 400));
    if (await isPortFree(p)) return p;
  }
  throw new Error(`No free port near ${start}`);
}

function waitForPort(p, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect(p, "127.0.0.1", () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`timeout waiting for vite on ${p}`));
        } else setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

if (!fs.existsSync(electronExe)) {
  console.error("Missing vendor/electron/electron.exe — run scripts/fetch-electron.ps1");
  process.exit(1);
}
if (!fs.existsSync(viteCli)) {
  console.error("Missing node_modules/vite — run npm install in project root");
  process.exit(1);
}

const port = await pickPort(preferredPort);
console.log(`Using Vite port ${port}`);

const vite = spawn(
  process.execPath,
  [viteCli, "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
  {
    cwd: desktopDir,
    stdio: "inherit",
    shell: false,
    env: { ...process.env },
  },
);

let shuttingDown = false;
const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    vite.kill();
  } catch {
    /* ignore */
  }
  process.exit(code);
};

vite.on("exit", (code) => {
  if (!shuttingDown && code && code !== 0) {
    console.error(`Vite exited with code ${code}`);
    shutdown(code);
  }
});

try {
  await waitForPort(port);
} catch (err) {
  console.error(String(err));
  shutdown(1);
}

const electron = spawn(electronExe, ["."], {
  cwd: desktopDir,
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    CGRAPH_DEV_URL: `http://127.0.0.1:${port}`,
  },
});

electron.on("exit", (code) => shutdown(code ?? 0));
electron.on("error", (err) => {
  console.error(err);
  shutdown(1);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
