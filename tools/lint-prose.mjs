import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const skipDirs = new Set(["node_modules", "dist", ".git", "test-results", "playwright-report", "coverage"]);
const scanned = /\.(md|mdx|tsx?|mts|mjs|json|html|css)$/;
const allowList = ["driver.js", "github.com/nilbuild/driver.js", "Kamran Ahmed"];

/**
 * Parses banned-word list text: one entry per line, blank lines and `#` comments ignored.
 * @param {string} text
 * @returns {string[]}
 */
export function parseWordList(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/**
 * Merges the committed list, the gitignored local list, and the `BANNED_WORDS` env var.
 * @param {{ committedFile?: string, localFile?: string, env?: Record<string, string | undefined> }} [options]
 * @returns {string[]}
 */
export function loadBannedWords(options = {}) {
  const committedFile = options.committedFile ?? join(toolsDir, "banned-words.txt");
  const localFile = options.localFile ?? join(toolsDir, "banned-words.local.txt");
  const env = options.env ?? process.env;
  const words = [];
  for (const file of [committedFile, localFile]) {
    if (existsSync(file)) words.push(...parseWordList(readFileSync(file, "utf8")));
  }
  const fromEnv = env["BANNED_WORDS"];
  if (fromEnv) words.push(...parseWordList(fromEnv.split(",").join("\n")));
  return [...new Set(words)];
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds banned words in one text, ignoring allow-listed strings.
 * @param {string} text
 * @param {string[]} words
 * @returns {{ line: number, word: string }[]}
 */
export function findViolations(text, words) {
  if (words.length === 0) return [];
  const allowed = new RegExp(allowList.map(escapeRegExp).join("|"), "gi");
  const patterns = words.map((word) => ({
    word,
    regex: new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(word)}(?![A-Za-z0-9])`, "i"),
  }));
  const found = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const cleaned = line.replace(allowed, " ");
    for (const { word, regex } of patterns) {
      if (regex.test(cleaned)) found.push({ line: index + 1, word });
    }
  });
  return found;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (entry.name !== "package-lock.json" && scanned.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

/**
 * Lints every Markdown, TypeScript, JavaScript module, JSON, HTML and CSS file under `root`.
 * @param {{ root: string, words: string[] }} options
 * @returns {{ file: string, line: number, word: string }[]}
 */
export function lintProse({ root, words }) {
  const violations = [];
  if (words.length === 0) return violations;
  for (const file of walk(root)) {
    for (const hit of findViolations(readFileSync(file, "utf8"), words)) {
      violations.push({ file: relative(root, file), ...hit });
    }
  }
  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(toolsDir, "..");
  const words = loadBannedWords();
  if (words.length === 0) {
    if (process.env["REQUIRE_BANNED_WORDS"] === "1") {
      console.error("lint:prose failed: REQUIRE_BANNED_WORDS=1 but 0 banned words loaded");
      process.exit(1);
    }
    if (process.env["CI"]) {
      console.error("WARNING: lint:prose loaded 0 banned words in CI; the lint is trivially green. Set BANNED_WORDS or REQUIRE_BANNED_WORDS=1.");
    }
  }
  const violations = lintProse({ root, words });
  if (violations.length > 0) {
    for (const v of violations) console.error(`${v.file}:${v.line}: banned word "${v.word}"`);
    console.error(`lint:prose failed with ${violations.length} violation(s)`);
    process.exit(1);
  }
  console.log(`lint:prose ok (${words.length} banned word(s) loaded)`);
}
