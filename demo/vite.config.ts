import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  define: { __DEV__: "true" },
  server: { port: Number(process.env["VT_E2E_PORT"] || 4173), strictPort: true, fs: { allow: [resolve(__dirname, "..")] } },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        e2e: resolve(__dirname, "e2e.html"),
        actionDriven: resolve(__dirname, "fixtures/action-driven.html"),
        navigation: resolve(__dirname, "fixtures/navigation.html"),
        lateTarget: resolve(__dirname, "fixtures/late-target.html"),
        skip: resolve(__dirname, "fixtures/skip.html"),
        prepare: resolve(__dirname, "fixtures/prepare.html"),
        autoAdvance: resolve(__dirname, "fixtures/auto-advance.html"),
        content: resolve(__dirname, "fixtures/content.html"),
      },
    },
  },
});
