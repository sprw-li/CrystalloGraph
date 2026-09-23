import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import fs from "node:fs";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const webDir = path.join(root, "apps", "web");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const port = Number(process.env.CGRAPH_PORT || 5173);

function killPortWindows(p) {
  try {
    const out = execSync(`netstat -ano | findstr :${p}`, {
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
        console.log(`Freed port ${p} (killed PID ${pid})`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* none */
  }
}

function isPortFree(p) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(p, "127.0.0.1");
  });
}

if (!fs.existsSync(viteCli)) {
  console.error("Missing vite — run npm install");
  process.exit(1);
}

if (!(await isPortFree(port))) {
  console.log(`Port ${port} busy, freeing...`);
  killPortWindows(port);
  await new Promise((r) => setTimeout(r, 500));
}

const vite = spawn(
  process.execPath,
  [viteCli, "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
  { cwd: webDir, stdio: "inherit", shell: false },
);

vite.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => {
  vite.kill();
  process.exit(0);
});
