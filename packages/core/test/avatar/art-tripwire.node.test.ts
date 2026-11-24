import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(coreRoot, "../..");
const MAX_PNG_BYTES = 200 * 1024;
const MAX_ANIMATIONS = 40;
const BANNED_NAMES = ["clippy", "clippit", "office-assistant"];

interface Entry {
  path: string;
  size: number;
  read(): Buffer;
}

function walk(root: string, dir: string, out: Entry[] = []): Entry[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(root, full, out);
    else if (name.isFile()) out.push({ path: relative(root, full), size: statSync(full).size, read: () => readFileSync(full) });
  }
  return out;
}

function animationCount(json: unknown): number {
  if (Array.isArray(json)) {
    return json.filter((item) => typeof item === "object" && item !== null && "Name" in item && "Frames" in item).length;
  }
  if (typeof json === "object" && json !== null) {
    const animations = (json as Record<string, unknown>)["animations"];
    if (typeof animations === "object" && animations !== null) return Object.keys(animations).length;
  }
  return 0;
}

function violations(entries: Entry[]): string[] {
  const found: string[] = [];
  for (const entry of entries) {
    const lower = entry.path.toLowerCase();
    for (const banned of BANNED_NAMES) {
      if (lower.includes(banned)) found.push(`${entry.path}: file name contains "${banned}"`);
    }
    if (lower.endsWith(".png") && entry.size > MAX_PNG_BYTES) found.push(`${entry.path}: PNG is ${entry.size} bytes`);
    if (lower.endsWith(".json")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(entry.read().toString("utf8"));
      } catch {
        continue;
      }
      const count = animationCount(parsed);
      if (count >= MAX_ANIMATIONS) found.push(`${entry.path}: JSON defines ${count} animations`);
    }
  }
  return found;
}

function tarballEntries(): Entry[] {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: coreRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const [report] = JSON.parse(output) as { files: { path: string; size: number }[] }[];
  return (report?.files ?? []).map((file) => ({
    path: file.path,
    size: file.size,
    read: () => readFileSync(join(coreRoot, file.path)),
  }));
}

describe("art tripwire", () => {
  it("finds no third-party character art in the repository", () => {
    const entries = [
      ...walk(coreRoot, join(coreRoot, "e2e/fixtures")),
      ...walk(coreRoot, join(coreRoot, "src/avatar")),
      ...walk(repoRoot, join(repoRoot, "docs")),
    ];
    const paths = entries.map((entry) => entry.path);
    expect(paths).toContain("e2e/fixtures/test-pack/pack.json");
    expect(paths).toContain("src/avatar/thumbtack/pack.json");
    expect(violations(entries)).toEqual([]);
  });

  it("finds none in the published tarball", () => {
    const entries = tarballEntries();
    expect(entries.map((entry) => entry.path)).toContain("package.json");
    expect(violations(entries)).toEqual([]);
  }, 60_000);

  describe("detection", () => {
    function scratch(files: Record<string, string | Buffer>): Entry[] {
      const dir = mkdtempSync(join(tmpdir(), "vt-tripwire-"));
      try {
        for (const [name, body] of Object.entries(files)) {
          mkdirSync(dirname(join(dir, name)), { recursive: true });
          writeFileSync(join(dir, name), body);
        }
        const entries = walk(dir, dir);
        return entries.map((entry) => {
          const bytes = entry.read();
          return { ...entry, read: () => bytes };
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    const names = (count: number): Record<string, unknown> =>
      Object.fromEntries(Array.from({ length: count }, (_v, i) => [`a${i}`, { frames: [] }]));

    it("flags a PNG over 200 KB but not one at the limit", () => {
      expect(violations(scratch({ "a/big.png": Buffer.alloc(204_801) }))).toHaveLength(1);
      expect(violations(scratch({ "a/ok.png": Buffer.alloc(204_800) }))).toEqual([]);
    });

    it("flags a JSON map with 40 or more animations in either shape", () => {
      expect(violations(scratch({ "m.json": JSON.stringify({ animations: names(40) }) }))).toHaveLength(1);
      expect(violations(scratch({ "m.json": JSON.stringify({ animations: names(39) }) }))).toEqual([]);
      const list = Array.from({ length: 40 }, (_v, i) => ({ Name: `n${i}`, Frames: [] }));
      expect(violations(scratch({ "m.json": JSON.stringify(list) }))).toHaveLength(1);
      expect(violations(scratch({ "m.json": JSON.stringify(list.slice(0, 39)) }))).toEqual([]);
    });

    it.each(["clippy", "clippit", "office-assistant"])("flags a file name containing %s in any case and folder", (word) => {
      expect(violations(scratch({ [`x/${word.toUpperCase()}-sheet.txt`]: "x" }))).toHaveLength(1);
      expect(violations(scratch({ [`${word}/readme.txt`]: "x" }))).toHaveLength(1);
    });

    it("ignores unparsable JSON and unrelated files", () => {
      expect(violations(scratch({ "bad.json": "{nope", "a.txt": "hi" }))).toEqual([]);
    });
  });
});
