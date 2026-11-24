import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkLinks, extractLinks } from "../../../../tools/check-links.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "check-links-"));
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

describe("extractLinks", () => {
  it("finds inline links, images, definitions, attributes and includes", () => {
    const text = [
      "[a](./one) and ![img](two.png \"title\")",
      "[ref]: three",
      '<a href="four">x</a>',
      "<<< @/snippets/x.ts{1-3}",
    ].join("\n");
    expect(extractLinks(text).map((l) => [l.line, l.target, l.kind])).toEqual([
      [1, "./one", "link"],
      [1, "two.png", "link"],
      [2, "three", "link"],
      [3, "four", "link"],
      [4, "@/snippets/x.ts", "include"],
    ]);
  });

  it("ignores links inside fenced and inline code", () => {
    const text = ["`[a](./nope)`", "```md", "[b](./nope)", "```", "[c](./yes)"].join("\n");
    expect(extractLinks(text).map((l) => l.target)).toEqual(["./yes"]);
  });
});

describe("checkLinks", () => {
  it("accepts extension-less pages, index pages, absolute site links, files, anchors and external links", () => {
    const root = project({
      "docs/index.md": "[g](/guide/a) [b](./guide/b#part) [i](./sub/) [e](https://example.org/x) [h](#top)",
      "docs/guide/a.md": "[b](./b) [up](../index) ![i](../pic.png)",
      "docs/guide/b.md": "[a](a.md)",
      "docs/sub/index.md": "[home](../index)",
      "docs/pic.png": "x",
      "README.md": "[docs](docs/guide/a.md)",
    });
    expect(checkLinks({ root })).toEqual([]);
  });

  it("reports a missing page, a missing include and a README link without its extension", () => {
    const root = project({
      "docs/guide/a.md": "[gone](./gone)\n<<< @/snippets/missing.ts",
      "README.md": "[docs](docs/guide/a)",
    });
    const problems = checkLinks({ root });
    expect(problems.map((p) => `${p.file}:${p.line}:${p.target}`)).toEqual([
      "docs/guide/a.md:1:./gone",
      "docs/guide/a.md:2:@/snippets/missing.ts",
      "README.md:1:docs/guide/a",
    ]);
  });

  it("skips node_modules", () => {
    const root = project({
      "docs/node_modules/p/readme.md": "[gone](./gone)",
      "docs/index.md": "ok",
    });
    expect(checkLinks({ root })).toEqual([]);
  });

  it("finds no broken link in this repository's docs and README", () => {
    expect(checkLinks({ root: repoRoot })).toEqual([]);
  });
});
