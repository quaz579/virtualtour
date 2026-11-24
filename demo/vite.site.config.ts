import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function thumbtackAssets() {
  let outDir = "";
  return {
    name: "virtualtour-thumbtack-assets",
    apply: "build" as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const assetsDir = resolve(outDir, "assets");
      mkdirSync(assetsDir, { recursive: true });
      cpSync(resolve(__dirname, "../packages/core/src/avatar/thumbtack"), resolve(assetsDir, "thumbtack"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [thumbtackAssets()],
  root: resolve(__dirname, "site"),
  define: { __DEV__: "false" },
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "virtual-site-tour": resolve(__dirname, "../packages/core/src/index.ts") } },
  server: { fs: { allow: [resolve(__dirname, "..")] } },
});
