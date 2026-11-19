import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __DEV__: "true" },
  resolve: { alias: { virtualtour: resolve(__dirname, "../core/src/index.ts") } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit-node", environment: "node", include: ["test/**/*.node.test.ts"] },
      },
      {
        extends: true,
        test: { name: "unit-dom", environment: "jsdom", include: ["test/**/*.test.ts"], exclude: ["test/**/*.node.test.ts"] },
      },
    ],
  },
});
