import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const entries = {
  index: resolve(__dirname, "src/index.ts"),
  avatar: resolve(__dirname, "src/avatar/index.ts"),
  motion: resolve(__dirname, "src/motion/index.ts"),
};

export default defineConfig(({ mode }) => {
  const dev = mode === "dev";
  return {
    define: { __DEV__: JSON.stringify(dev) },
    build: {
      target: "es2020",
      emptyOutDir: !dev,
      sourcemap: true,
      lib: {
        entry: dev ? { "index.dev": entries.index } : entries,
        formats: ["es"],
        fileName: (_format, name) => `${name}.js`,
        cssFileName: "base",
      },
      rollupOptions: {
        external: [/^\.\.\/index(\.ts)?$/],
      },
    },
    plugins: dev
      ? []
      : [
          dts({
            include: ["src/index.ts", "src/avatar", "src/motion"],
            tsconfigPath: resolve(__dirname, "tsconfig.json"),
            beforeWriteFile: (filePath, content) => ({
              filePath: filePath.replace(/\/(avatar|motion)\/index\.d\.ts$/, "/$1.d.ts"),
              content,
            }),
          }),
        ],
  };
});
