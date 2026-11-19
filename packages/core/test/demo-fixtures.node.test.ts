import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const demo = join(repo, "demo");
const e2eDir = resolve(here, "../e2e");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const specs = walk(e2eDir).filter((f) => f.endsWith(".spec.ts"));
const referenced = new Map<string, string[]>();
for (const spec of specs) {
  const source = readFileSync(spec, "utf8");
  for (const match of source.matchAll(/["'`]\/((?:fixtures\/)?[\w-]+\.html)/g)) {
    const page = match[1] as string;
    referenced.set(page, [...(referenced.get(page) ?? []), spec]);
  }
}

const viteConfig = readFileSync(join(demo, "vite.config.ts"), "utf8");

describe("demo fixtures", () => {
  it("finds the pages the specs navigate to", () => {
    expect(referenced.size).toBeGreaterThan(10);
  });

  it.each([...referenced.keys()])("%s exists in demo/", (page) => {
    expect(existsSync(join(demo, page))).toBe(true);
  });

  it.each([...referenced.keys()])("%s is part of the demo build", (page) => {
    expect(viteConfig).toContain(`"${page}"`);
  });

  it("every demo page is part of the demo build and has a script that exists", () => {
    const pages = [...readdirSync(demo).filter((f) => f.endsWith(".html")), ...readdirSync(join(demo, "fixtures")).filter((f) => f.endsWith(".html")).map((f) => `fixtures/${f}`)];
    for (const page of pages) {
      expect(viteConfig, page).toContain(`"${page}"`);
      const html = readFileSync(join(demo, page), "utf8");
      for (const match of html.matchAll(/<script[^>]*src="\.\/([^"]+)"/g)) {
        expect(existsSync(join(demo, dirname(page), match[1] as string)), `${page} -> ${match[1]}`).toBe(true);
      }
    }
  });
});
