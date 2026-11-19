import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sizeFile = resolve(root, "../../SIZE.md");
const entries = [
  { name: "core", file: "dist/index.js", target: 21 },
  { name: "engine", file: "src/engine/driver.ts", target: 21, engine: true },
  { name: "avatar", file: "dist/avatar.js", target: 6 },
  { name: "motion", file: "dist/motion.js", target: 2 },
  { name: "base.css", file: "dist/base.css", target: null },
  { name: "theme.css", file: "dist/theme.css", target: null },
];

function kb(bytes) {
  return (bytes / 1024).toFixed(2);
}

function readBaseline() {
  const baseline = new Map();
  if (!existsSync(sizeFile)) return baseline;
  for (const line of readFileSync(sizeFile, "utf8").split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const bytes = Number(cells[3]);
    if (cells.length > 4 && cells[1] && Number.isFinite(bytes) && cells[3] !== "") {
      baseline.set(cells[1], bytes);
    }
  }
  return baseline;
}

if (!process.argv.includes("--no-build")) {
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
}

async function bundleEngine() {
  const result = await build({
    root,
    configFile: false,
    logLevel: "silent",
    define: { __DEV__: "false" },
    build: {
      write: false,
      target: "es2020",
      lib: { entry: join(root, "src/engine/driver.ts"), formats: ["es"], fileName: "engine" },
    },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const chunk = output.find((item) => item.type === "chunk" && item.isEntry);
  return Buffer.from(chunk.code);
}

const baseline = readBaseline();
const rows = [];
const warnings = [];
for (const entry of entries) {
  const path = join(root, entry.file);
  if (!entry.engine && !existsSync(path)) {
    warnings.push(`warning: ${entry.file} was not built`);
    continue;
  }
  const raw = entry.engine ? await bundleEngine() : readFileSync(path);
  const gzip = gzipSync(raw, { level: 9 }).length;
  const before = baseline.get(entry.name);
  const delta = before === undefined ? "n/a" : `${gzip - before >= 0 ? "+" : ""}${gzip - before}`;
  rows.push({ ...entry, raw: raw.length, gzip, delta });
  if (entry.target !== null && gzip / 1024 > entry.target) {
    warnings.push(`warning: ${entry.name} is ${kb(gzip)} KB gzip, above the ${entry.target} KB soft target`);
  }
}

const header = "| Entry | File | Gzip (bytes) | Gzip (KB) | Raw (KB) | Delta vs SIZE.md |";
const divider = "|---|---|---|---|---|---|";
const lines = rows.map(
  (row) => `| ${row.name} | ${row.file} | ${row.gzip} | ${kb(row.gzip)} | ${kb(row.raw)} | ${row.delta} |`,
);
for (const warning of warnings) console.log(warning);
console.log([header, divider, ...lines].join("\n"));

if (process.argv.includes("--write")) {
  const body = [
    "# Size baseline",
    "",
    "Gzip sizes of the built entries. Refresh with `npm run size -- --write`.",
    "",
    "| Entry | File | Gzip (bytes) |",
    "|---|---|---|",
    ...rows.map((row) => `| ${row.name} | ${row.file} | ${row.gzip} |`),
    "",
  ].join("\n");
  writeFileSync(sizeFile, body);
}
