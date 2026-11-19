import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    target: "es2020",
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "virtualtour"],
    },
  },
  plugins: [dts({ include: ["src"], tsconfigPath: resolve(__dirname, "tsconfig.build.json"), entryRoot: "src" })],
});
