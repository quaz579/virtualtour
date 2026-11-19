import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const skipDirs = new Set(["node_modules", "dist", ".git", ".vitepress", "plan"]);
const external = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function* markdownFiles(dir, top) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!(skipDirs.has(entry.name) && (entry.name !== "plan" || dir === top))) yield* markdownFiles(join(dir, entry.name), top);
    } else if (entry.name.endsWith(".md")) {
      yield join(dir, entry.name);
    }
  }
}

function stripCode(text) {
  const lines = text.split(/\r?\n/);
  let fence = null;
  return lines.map((line) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return "";
    }
    if (marker) {
      fence = marker[1];
      return "";
    }
    return line.replace(/`[^`]*`/g, "``");
  });
}

/**
 * Lists the link targets in Markdown text: inline links, images, reference definitions, `href`/`src`
 * attributes, and VitePress `<<<` snippet includes. Fenced and inline code is ignored.
 * @param {string} text
 * @returns {{ line: number, target: string, kind: "link" | "include" }[]}
 */
export function extractLinks(text) {
  const found = [];
  stripCode(text).forEach((line, index) => {
    const lineNumber = index + 1;
    for (const match of line.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g)) {
      found.push({ line: lineNumber, target: match[1], kind: "link" });
    }
    const definition = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+["'(].*)?$/.exec(line);
    if (definition) found.push({ line: lineNumber, target: definition[1], kind: "link" });
    for (const match of line.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      found.push({ line: lineNumber, target: match[1], kind: "link" });
    }
    const include = /^\s*<<<\s*(\S+?)(?:\{[^}]*\})?(?:\s|$)/.exec(line);
    if (include) found.push({ line: lineNumber, target: include[1], kind: "include" });
  });
  return found;
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

/**
 * Resolves a relative target to a file, or returns null. With `pages`, an extension-less target may name `<target>.md`
 * or `<target>/index.md`, the way VitePress resolves it; without it only exact files count.
 */
function resolveTarget(base, pages) {
  if (isFile(base)) return base;
  if (!pages) return null;
  if (/\/$/.test(base)) return isFile(join(base, "index.md")) ? join(base, "index.md") : null;
  if (isFile(`${base}.md`)) return `${base}.md`;
  if (isFile(join(base, "index.md"))) return join(base, "index.md");
  return null;
}

/**
 * Checks every relative link in `docs/**` Markdown (the `plan` folder excluded) and in the root README.
 * Anchors and query strings are ignored; only the target file must exist.
 * @param {{ root: string }} options
 * @returns {{ file: string, line: number, target: string, reason: string }[]}
 */
export function checkLinks({ root }) {
  const docsDir = join(root, "docs");
  const files = [];
  if (existsSync(docsDir)) for (const file of markdownFiles(docsDir, docsDir)) files.push({ file, pages: true, base: docsDir });
  const readme = join(root, "README.md");
  if (isFile(readme)) files.push({ file: readme, pages: false, base: root });

  const problems = [];
  for (const { file, pages, base } of files) {
    for (const { line, target, kind } of extractLinks(readFileSync(file, "utf8"))) {
      if (kind === "link" && (external.test(target) || target.startsWith("#"))) continue;
      const path = decodeURI(target.split(/[?#]/)[0]);
      if (path === "") continue;
      let absolute;
      if (kind === "include" && path.startsWith("@/")) absolute = join(docsDir, path.slice(2));
      else if (path.startsWith("/")) absolute = join(base, path);
      else absolute = resolve(dirname(file), path);
      const found = resolveTarget(absolute, kind === "link" && pages);
      if (!found) {
        problems.push({ file: relative(root, file), line, target, reason: kind === "include" ? "included file not found" : "no such page or file" });
      }
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(toolsDir, "..");
  const problems = checkLinks({ root });
  if (problems.length > 0) {
    for (const p of problems) console.error(`${p.file}:${p.line}: ${p.reason}: ${p.target}`);
    console.error(`check-links failed with ${problems.length} broken link(s)`);
    process.exit(1);
  }
  console.log("check-links ok");
}
