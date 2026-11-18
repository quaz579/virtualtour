import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  define: { __DEV__: "true" },
  server: { fs: { allow: [resolve(__dirname, "..")] } },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        e2e: resolve(__dirname, "e2e.html"),
      },
    },
  },
});
