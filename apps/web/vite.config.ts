import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/, set via VITE_BASE in CI.
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@cgraph/core/styles.css": path.resolve(
        __dirname,
        "../../packages/core/src/ui/styles.css",
      ),
      "@cgraph/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    strictPort: true,
  },
});
