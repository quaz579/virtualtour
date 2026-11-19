import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit-node",
          environment: "node",
          include: ["test/**/*.node.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "unit-dom",
          environment: "jsdom",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.node.test.ts"],
          setupFiles: ["test/setup-dom.ts"],
        },
      },
    ],
  },
});
