import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const builtToday = [
  "dist/index.js",
  "dist/index.dev.js",
  "dist/avatar.js",
  "dist/motion.js",
  "dist/index.d.ts",
  "dist/avatar.d.ts",
  "dist/motion.d.ts",
  "dist/base.css",
  "dist/theme.css",
  "dist/avatar.css",
  "dist/thumbtack/pack.json",
  "dist/thumbtack/sheet.png",
  "dist/thumbtack/LICENSE-ART.md",
];

const notBuiltYet: string[] = [];

function exportTargets(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(exportTargets);
  return [];
}

function bareSpecifiers(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bimport\s+(?:[^"'()]*?\sfrom\s*)?["']([^"']+)["']/g,
    /\bexport\s+[^"'()]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier && !specifier.startsWith(".") && !specifier.startsWith("/")) found.push(specifier);
    }
  }
  return found;
}

describe("build output", () => {
  beforeAll(() => {
    execFileSync("npm", ["run", "build"], { cwd: join(root, "../.."), stdio: "ignore" });
  }, 180_000);

  it.each(builtToday)("emits %s", (file) => {
    expect(existsSync(join(root, file))).toBe(true);
  });

  it("has no bare imports in any built script", () => {
    const scripts = readdirSync(dist).filter((name) => name.endsWith(".js"));
    expect(scripts).toContain("index.js");
    for (const name of scripts) {
      expect(bareSpecifiers(readFileSync(join(dist, name), "utf8")), name).toEqual([]);
    }
  });

  it("detects a bare import when one is present", () => {
    expect(bareSpecifiers('import { a } from "lodash";\nimport "./x.js";')).toEqual(["lodash"]);
    expect(bareSpecifiers('export * from "left-pad";')).toEqual(["left-pad"]);
    expect(bareSpecifiers('const m = import("react");')).toEqual(["react"]);
  });

  it("ships theme.css unchanged and base.css with the marker", () => {
    expect(readFileSync(join(dist, "theme.css"), "utf8")).toBe(readFileSync(join(root, "src/styles/theme.css"), "utf8"));
    expect(readFileSync(join(dist, "base.css"), "utf8")).toMatch(/--vt-base:\s*1/);
  });

  it("ships avatar.css unchanged", () => {
    expect(readFileSync(join(dist, "avatar.css"), "utf8")).toBe(readFileSync(join(root, "src/styles/avatar.css"), "utf8"));
  });

  it("keeps the missing-stylesheet warning out of the production build only", () => {
    const warning = "base.css is not loaded";
    expect(readFileSync(join(dist, "index.js"), "utf8")).not.toContain(warning);
    expect(readFileSync(join(dist, "index.dev.js"), "utf8")).toContain(warning);
  });

  it("has no dependencies key", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<string, unknown>;
    expect(pkg).not.toHaveProperty("dependencies");
  });

  it("ships both schemas", () => {
    expect(existsSync(join(root, "schemas/avatar-pack.v1.schema.json"))).toBe(true);
    expect(existsSync(join(root, "schemas/tour.v1.schema.json"))).toBe(true);
  });

  it("every export target is either built or explicitly pending", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { exports: unknown };
    for (const target of exportTargets(pkg.exports)) {
      const exists = existsSync(join(root, target.replace(/\*.*$/, "")));
      const pending = notBuiltYet.includes(target);
      expect(exists || pending, `${target} is neither built nor listed as pending`).toBe(true);
    }
  });
});

const repoRoot = resolve(root, "../..");

const builtPatterns = [/^dist\/[^/]+\.js$/, /^dist\/[^/]+\.js\.map$/, /^dist\/[^/]+\.d\.ts$/, /^dist\/[^/]+\.css$/];

const packContents: Record<string, { exact: string[]; required: string[] }> = {
  virtualtour: {
    exact: [
      "ART.md",
      "CHANGELOG.md",
      "LICENSE",
      "NOTICE.md",
      "README.md",
      "STYLES.md",
      "package.json",
      "schemas/avatar-pack.v1.schema.json",
      "schemas/tour.v1.schema.json",
      "dist/thumbtack/LICENSE-ART.md",
      "dist/thumbtack/pack.json",
      "dist/thumbtack/sheet.png",
    ],
    required: ["dist/index.js", "dist/index.d.ts", "dist/avatar.js", "dist/motion.js", "dist/base.css", "dist/theme.css", "dist/avatar.css"],
  },
  "virtualtour-react": { exact: ["LICENSE", "README.md", "package.json"], required: ["dist/index.js", "dist/index.d.ts"] },
  "virtualtour-vue": { exact: ["LICENSE", "README.md", "package.json"], required: ["dist/index.js", "dist/index.d.ts"] },
};

function packedPaths(workspace: string): string[] {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts", "--workspace", workspace], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const [report] = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
  return report!.files.map((file) => file.path);
}

describe("package contents", () => {
  it.each(Object.keys(packContents))("%s packs exactly the intended files", (workspace) => {
    const { exact, required } = packContents[workspace]!;
    const paths = packedPaths(workspace);
    for (const path of [...exact, ...required]) {
      expect(paths, `${workspace} is missing ${path}`).toContain(path);
    }
    const unexpected = paths.filter((path) => !exact.includes(path) && !builtPatterns.some((pattern) => pattern.test(path)));
    expect(unexpected, `${workspace} packs files nobody listed`).toEqual([]);
  }, 120_000);

  it("ships exactly one image, the Thumbtack sheet", () => {
    expect(packedPaths("virtualtour").filter((path) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path))).toEqual(["dist/thumbtack/sheet.png"]);
  });
});

const consumerFiles: Record<string, string> = {
  "core.ts": `import { createTour, type Tour, type TourConfig, type TourStep } from "virtualtour";
const config: TourConfig = { steps: [] };
const tour: Tour = createTour(config);
const steps: readonly TourStep[] = tour.steps;
export { steps };
`,
  "avatar.ts": `import { withAvatar, SpeakerPresenter, thumbtackPack, type AvatarPack, type NormalizedPack } from "virtualtour/avatar";
export const pieces: [typeof withAvatar, typeof SpeakerPresenter, typeof thumbtackPack] = [withAvatar, SpeakerPresenter, thumbtackPack];
export type Packs = [AvatarPack, NormalizedPack];
`,
  "motion.ts": `import { glide, progressVars } from "virtualtour/motion";
export const addons = [glide, progressVars];
`,
  "react.ts": `import { TourProvider, useTour, type TourProviderProps, type UseTourResult } from "virtualtour-react";
export const pieces: [typeof TourProvider, typeof useTour] = [TourProvider, useTour];
export type Types = [TourProviderProps, UseTourResult];
`,
  "vue.ts": `import * as vue from "virtualtour-vue";
export const names = Object.keys(vue);
export const provider: typeof vue.TourProvider = vue.TourProvider;
export const hook: () => vue.UseTourResult = vue.useTour;
`,
};

const consumerConfigs: Record<string, Record<string, unknown>> = {
  bundler: { module: "esnext", moduleResolution: "bundler" },
  node16: { module: "node16", moduleResolution: "node16" },
};

describe("published declarations", () => {
  let consumer = "";
  let scratch = "";

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), "vt-consumer-"));
    consumer = join(scratch, "consumer");
    const modules = join(consumer, "node_modules");
    mkdirSync(modules, { recursive: true });
    const hostModules = join(repoRoot, "node_modules");
    for (const name of readdirSync(hostModules)) {
      if (name.startsWith(".") || name.startsWith("virtualtour")) continue;
      symlinkSync(join(hostModules, name), join(modules, name));
    }
    const tarballs = join(scratch, "tarballs");
    mkdirSync(tarballs);
    for (const workspace of ["virtualtour", "virtualtour-react", "virtualtour-vue"]) {
      const out = execFileSync("npm", ["pack", "--workspace", workspace, "--pack-destination", tarballs, "--json"], { cwd: repoRoot, encoding: "utf8" });
      const [info] = JSON.parse(out) as Array<{ filename: string }>;
      const target = join(modules, workspace);
      mkdirSync(target);
      execFileSync("tar", ["-xzf", join(tarballs, info!.filename), "-C", target, "--strip-components=1"]);
    }
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
    for (const [file, source] of Object.entries(consumerFiles)) writeFileSync(join(consumer, file), source);
    for (const [name, options] of Object.entries(consumerConfigs)) {
      writeFileSync(
        join(consumer, `tsconfig.${name}.json`),
        JSON.stringify({
          compilerOptions: { ...options, target: "es2022", strict: true, noEmit: true, skipLibCheck: false, jsx: "react-jsx", lib: ["es2022", "dom", "dom.iterable"], types: [] },
          include: Object.keys(consumerFiles),
        }),
      );
    }
  }, 300_000);

  afterAll(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  });

  it("packs declarations whose relative imports all resolve inside the tarball", () => {
    const dir = join(consumer, "node_modules/virtualtour/dist");
    const relative = /\bfrom\s*["'](\.[^"']*)["']/g;
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".d.ts"))) {
      for (const match of readFileSync(join(dir, file), "utf8").matchAll(relative)) {
        const target = match[1]!;
        expect(target, `${file} imports ${target} without a .js extension`).toMatch(/\.js$/);
        expect(existsSync(join(dir, target.replace(/\.js$/, ".d.ts"))), `${file} imports ${target} which is not shipped`).toBe(true);
      }
    }
  });

  it.each(Object.keys(consumerConfigs))("a consumer importing every entry point typechecks under %s", (name) => {
    const tsc = join(repoRoot, "node_modules/typescript/bin/tsc");
    const result = spawnSync(process.execPath, [tsc, "-p", `tsconfig.${name}.json`], { cwd: consumer, encoding: "utf8" });
    expect(result.stdout + result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 120_000);
});
