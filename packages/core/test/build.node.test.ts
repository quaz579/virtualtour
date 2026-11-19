import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

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
  "dist/thumbtack/pack.json",
  "dist/thumbtack/sheet.png",
  "dist/thumbtack/LICENSE-ART.md",
];

const notBuiltYet = [
  "./dist/theme.css",
  "./dist/avatar.css",
];

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
    execFileSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
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
