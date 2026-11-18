import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findViolations, lintProse, loadBannedWords, parseWordList } from "../../../tools/lint-prose.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "lint-prose-"));
}

describe("banned-words sources", () => {
  it("the committed list holds no words", () => {
    const text = readFileSync(join(repoRoot, "tools/banned-words.txt"), "utf8");
    expect(parseWordList(text)).toEqual([]);
  });

  it("ignores blank lines and comments", () => {
    expect(parseWordList("# note\n\n  zorblax  \n#another\nquuxcorp\n")).toEqual(["zorblax", "quuxcorp"]);
  });

  it("reads a word from the local file", () => {
    const dir = tempDir();
    const committedFile = join(dir, "committed.txt");
    const localFile = join(dir, "local.txt");
    writeFileSync(committedFile, "# nothing\n");
    writeFileSync(localFile, "# local\nzorblax\n");
    expect(loadBannedWords({ committedFile, localFile, env: {} })).toEqual(["zorblax"]);
  });

  it("reads words from BANNED_WORDS", () => {
    const dir = tempDir();
    const words = loadBannedWords({
      committedFile: join(dir, "missing-a.txt"),
      localFile: join(dir, "missing-b.txt"),
      env: { BANNED_WORDS: "zorblax, quuxcorp ,,#skip" },
    });
    expect(words).toEqual(["zorblax", "quuxcorp"]);
  });

  it("merges all three sources without duplicates", () => {
    const dir = tempDir();
    const committedFile = join(dir, "committed.txt");
    const localFile = join(dir, "local.txt");
    writeFileSync(committedFile, "alpha\n");
    writeFileSync(localFile, "beta\nalpha\n");
    expect(loadBannedWords({ committedFile, localFile, env: { BANNED_WORDS: "gamma" } })).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });
});

describe("violation detection", () => {
  it("catches a local-file word in a Markdown file", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "docs/page.md"), "Welcome\nThis mentions Zorblax here.\n");
    const localFile = join(dir, "local.txt");
    writeFileSync(localFile, "zorblax\n");
    const words = loadBannedWords({ committedFile: join(dir, "none.txt"), localFile, env: {} });
    expect(lintProse({ root: dir, words })).toEqual([{ file: join("docs", "page.md"), line: 2, word: "zorblax" }]);
  });

  it("catches an env-var word in a TypeScript doc comment", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "a.ts"), "/** Built for quuxcorp. */\nexport const a = 1;\n");
    const words = loadBannedWords({
      committedFile: join(dir, "none.txt"),
      localFile: join(dir, "none2.txt"),
      env: { BANNED_WORDS: "quuxcorp" },
    });
    expect(lintProse({ root: dir, words })).toHaveLength(1);
  });

  it("matches whole words only and honors the allow list", () => {
    expect(findViolations("zorblaxes everywhere", ["zorblax"])).toEqual([]);
    expect(findViolations("see https://github.com/nilbuild/driver.js", ["driver"])).toEqual([]);
    expect(findViolations("Copyright (c) Kamran Ahmed", ["ahmed"])).toEqual([]);
  });

  it("passes when no words are loaded", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "a.md"), "anything goes\n");
    expect(lintProse({ root: dir, words: [] })).toEqual([]);
  });
});
