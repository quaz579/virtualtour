import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "engine" && dir === SRC ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+["'][^"']*engine\/driver(?:\.[jt]s)?["']/gm;

describe("engine boundary", () => {
  it("only src/tour.ts imports a value from engine/driver.ts outside src/engine", () => {
    const offenders = sources(SRC)
      .filter((file) => new RegExp(VALUE_IMPORT.source, "m").test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual(["tour.ts"]);
  });

  it("the matcher recognizes value imports and ignores type-only ones", () => {
    const value = `import { createEngine } from "./engine/driver";`;
    const typeOnly = `import type { Driver } from "./engine/driver";`;
    const mixed = `import { type Driver, createEngine } from "./engine/driver";`;
    const reexport = `export { createEngine } from "./engine/driver";`;
    const matches = (text: string) => new RegExp(VALUE_IMPORT.source, "m").test(text);

    expect(matches(value)).toBe(true);
    expect(matches(mixed)).toBe(true);
    expect(matches(reexport)).toBe(true);
    expect(matches(typeOnly)).toBe(false);
  });
});
