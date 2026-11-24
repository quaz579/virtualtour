import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "site"),
  define: { __DEV__: "false" },
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "virtual-site-tour": resolve(__dirname, "../packages/core/src/index.ts") } },
  server: { fs: { allow: [resolve(__dirname, "..")] } },
});
