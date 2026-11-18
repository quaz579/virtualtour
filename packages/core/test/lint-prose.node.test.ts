import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findViolations, lintProse, loadBannedWords, parseWordList } from "../../../tools/lint-prose.mjs";

const alpha = ["zor", "blax"].join("");
const beta = ["quux", "corp"].join("");
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
    expect(parseWordList(`# note\n\n  ${alpha}  \n#another\n${beta}\n`)).toEqual([alpha, beta]);
  });

  it("reads a word from the local file", () => {
    const dir = tempDir();
    const committedFile = join(dir, "committed.txt");
    const localFile = join(dir, "local.txt");
    writeFileSync(committedFile, "# nothing\n");
    writeFileSync(localFile, `# local\n${alpha}\n`);
    expect(loadBannedWords({ committedFile, localFile, env: {} })).toEqual([alpha]);
  });

  it("reads words from BANNED_WORDS", () => {
    const dir = tempDir();
    const words = loadBannedWords({
      committedFile: join(dir, "missing-a.txt"),
      localFile: join(dir, "missing-b.txt"),
      env: { BANNED_WORDS: `${alpha}, ${beta} ,,#skip` },
    });
    expect(words).toEqual([alpha, beta]);
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
    writeFileSync(join(dir, "docs/page.md"), `Welcome\nThis mentions ${alpha.toUpperCase()} here.\n`);
    const localFile = join(dir, "local.txt");
    writeFileSync(localFile, `${alpha}\n`);
    const words = loadBannedWords({ committedFile: join(dir, "none.txt"), localFile, env: {} });
    expect(lintProse({ root: dir, words })).toEqual([{ file: join("docs", "page.md"), line: 2, word: alpha }]);
  });

  it("catches an env-var word in a TypeScript doc comment", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "a.ts"), `/** Built for ${beta}. */\nexport const a = 1;\n`);
    const words = loadBannedWords({
      committedFile: join(dir, "none.txt"),
      localFile: join(dir, "none2.txt"),
      env: { BANNED_WORDS: beta },
    });
    expect(lintProse({ root: dir, words })).toHaveLength(1);
  });

  it("matches whole words only and honors the allow list", () => {
    expect(findViolations(`${alpha}es everywhere`, [alpha])).toEqual([]);
    expect(findViolations("see https://github.com/nilbuild/driver.js", ["driver"])).toEqual([]);
    expect(findViolations("Copyright (c) Kamran Ahmed", ["ahmed"])).toEqual([]);
  });

  it("passes when no words are loaded", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "a.md"), "anything goes\n");
    expect(lintProse({ root: dir, words: [] })).toEqual([]);
  });
});

describe("empty word list guard", () => {
  function runCli(env: Record<string, string>) {
    const dir = realpathSync(tempDir());
    mkdirSync(join(dir, "tools"));
    copyFileSync(join(repoRoot, "tools/lint-prose.mjs"), join(dir, "tools/lint-prose.mjs"));
    writeFileSync(join(dir, "a.md"), "hello\n");
    const base: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !["CI", "REQUIRE_BANNED_WORDS", "BANNED_WORDS"].includes(key)) base[key] = value;
    }
    return spawnSync(process.execPath, [join(dir, "tools/lint-prose.mjs")], {
      env: { ...base, ...env },
      encoding: "utf8",
    });
  }

  it("passes quietly with zero words by default", () => {
    const result = runCli({});
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("WARNING");
  });

  it("fails with zero words when REQUIRE_BANNED_WORDS=1", () => {
    const result = runCli({ REQUIRE_BANNED_WORDS: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("0 banned words");
  });

  it("warns loudly with zero words when CI is set", () => {
    const result = runCli({ CI: "true" });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("WARNING");
  });

  it("passes when words are loaded and REQUIRE_BANNED_WORDS=1", () => {
    const result = runCli({ REQUIRE_BANNED_WORDS: "1", BANNED_WORDS: alpha });
    expect(result.status).toBe(0);
  });
});

describe("scanned file types", () => {
  it("scans json, html, css, mjs and mts but skips package-lock.json and node_modules", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "node_modules"));
    for (const name of ["a.json", "a.html", "a.css", "a.mjs", "a.mts"]) writeFileSync(join(dir, name), `x ${alpha}\n`);
    writeFileSync(join(dir, "package-lock.json"), `x ${alpha}\n`);
    writeFileSync(join(dir, "node_modules/b.json"), `x ${alpha}\n`);
    const files = lintProse({ root: dir, words: [alpha] }).map((v) => v.file).sort();
    expect(files).toEqual(["a.css", "a.html", "a.json", "a.mjs", "a.mts"]);
  });
});
