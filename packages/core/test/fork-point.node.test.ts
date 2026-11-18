import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = join(root, "src/engine");
const fixture = join(root, "test/fixtures/fork-point.sha256");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function fingerprint(): string {
  return listFiles(engineDir)
    .map((file) => relative(engineDir, file).split("\\").join("/"))
    .sort()
    .map((name) => {
      const hash = createHash("sha256").update(readFileSync(join(engineDir, name))).digest("hex");
      return `${hash}  ${name}`;
    })
    .join("\n")
    .concat("\n");
}

describe("fork point", () => {
  it("src/engine matches test/fixtures/fork-point.sha256", () => {
    const actual = fingerprint();
    if (process.env["UPDATE_FORK_POINT"]) {
      if (process.env["CI"]) throw new Error("UPDATE_FORK_POINT must not be set in CI");
      writeFileSync(fixture, actual);
    }
    expect(actual).toBe(readFileSync(fixture, "utf8"));
  });
});
