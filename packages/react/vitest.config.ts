import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __DEV__: "true" },
  resolve: { alias: { "virtual-site-tour": resolve(__dirname, "../core/src/index.ts") } },
  esbuild: { jsx: "automatic" },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit-node", environment: "node", include: ["test/**/*.node.test.tsx"] },
      },
      {
        extends: true,
        test: { name: "unit-dom", environment: "jsdom", include: ["test/**/*.test.tsx"], exclude: ["test/**/*.node.test.tsx"] },
      },
    ],
  },
});
