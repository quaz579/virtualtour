import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import dts from "rollup-plugin-dts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = resolve(root, ".dts-tmp");

rmSync(tmp, { recursive: true, force: true });
try {
  execFileSync(process.execPath, [resolve(root, "../../node_modules/typescript/bin/tsc"), "-p", resolve(root, "tsconfig.dts.json")], {
    cwd: root,
    stdio: "inherit",
  });
  const bundle = await rollup({
    input: {
      index: resolve(tmp, "index.d.ts"),
      avatar: resolve(tmp, "avatar/index.d.ts"),
      motion: resolve(tmp, "motion/index.d.ts"),
    },
    plugins: [
      {
        name: "drop-css-imports",
        resolveId: (source) => (source.endsWith(".css") ? { id: `\0empty:${source}`, moduleSideEffects: false } : null),
        load: (id) => (id.startsWith("\0empty:") ? "export {};" : null),
      },
      dts({ respectExternal: false }),
    ],
  });
  await bundle.write({ dir: resolve(root, "dist"), format: "es", entryFileNames: "[name].d.ts", chunkFileNames: "types-[hash].d.ts" });
  await bundle.close();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
