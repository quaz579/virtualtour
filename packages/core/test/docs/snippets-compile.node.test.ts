import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("docs snippets", () => {
  it("compile under docs/tsconfig.json", { timeout: 300_000 }, () => {
    const result = spawnSync("npx", ["--no-install", "tsc", "--noEmit", "-p", "docs/tsconfig.json"], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 280_000,
    });
    expect(result.error).toBeUndefined();
    expect(`${result.stdout}${result.stderr}`.trim()).toBe("");
    expect(result.status).toBe(0);
  });
});
