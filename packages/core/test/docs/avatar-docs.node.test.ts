import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { detectClassicFormat, fromClassicColumnRowMap, fromClassicPositionMap } from "../../src/avatar/classic";
import { normalizePack, resolveRole, validatePack } from "../../src/avatar/pack";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const docs = join(repoRoot, "docs");
const read = (path: string): string => readFileSync(join(repoRoot, path), "utf8");
const json = (path: string): any => JSON.parse(read(path));

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", ".vitepress", "plan"].includes(entry.name)) markdownFiles(full, out);
    } else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const WARNING = [
  "> **Not included, not open source.** The classic paperclip character and its artwork belong",
  "> to Microsoft Corporation. This project does not ship, host, link to, or license that art.",
  "> The MIT license of this project covers this project's code and its own Thumbtack character",
  "> only. If you load third-party character art with this library, you are responsible for",
  "> having the right to use it. Nothing on this page is legal advice.",
].join("\n");

describe("avatar docs", () => {
  const classic = read("docs/avatar/classic-packs.md");

  it("opens the classic page with the required warning block, verbatim and before anything else", () => {
    const body = classic.split("\n").slice(2).join("\n").trimStart();
    expect(body.startsWith(WARNING)).toBe(true);
    expect(classic.startsWith("# Loading a classic paperclip (Clippy) avatar pack (not included)\n")).toBe(true);
  });

  it("links to no image, no sheet or map file and nothing but the one license page", () => {
    const targets = [...classic.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1] as string);
    const external = targets.filter((target) => /^[a-z][a-z0-9+.-]*:/i.test(target));
    expect(external).toEqual(["https://github.com/felixrieseberg/clippy/blob/main/LICENSE.md"]);
    expect(classic).not.toMatch(/!\[/);
    expect(classic).not.toMatch(/\.(png|gif|webp|jpe?g|svg)\b/i);
    const urls = [...classic.matchAll(/https?:\/\/[^\s"'`)]+/g)].map((match) => match[0]);
    for (const url of urls) {
      expect(url.startsWith("https://assets.your-company.example/") || url === "https://github.com/felixrieseberg/clippy/blob/main/LICENSE.md").toBe(true);
    }
  });

  it("makes none of the statements the licensing plan forbids", () => {
    const prose = classic.replace(WARNING, "");
    expect(prose).not.toMatch(/public domain|free to use|fair use (applies|covers|protects)/i);
    expect(prose).not.toMatch(/\b(is|are) open source\b/i);
  });

  it("carries both copyright lines from LICENSE and the fork point from NOTICE.md on the licensing page", () => {
    const page = read("docs/licensing.md");
    const copyright = read("LICENSE").split("\n").filter((line) => line.startsWith("Copyright (c)"));
    expect(copyright).toHaveLength(2);
    for (const line of copyright) expect(page).toContain(line);
    const notice = read("NOTICE.md");
    const commit = /Fork point commit \| `([0-9a-f]{40})`/.exec(notice)?.[1];
    const tag = /Fork point tag \| `([^`]+)`/.exec(notice)?.[1];
    expect(commit).toBeDefined();
    expect(page).toContain(commit as string);
    expect(page).toContain(`\`${tag}\``);
    expect(page).toMatch(/CC0 1\.0/);
  });

  it("holds no image whose name or alt text names the classic character", () => {
    const banned = /clippy|clippit|office[ -]?assistant/i;
    for (const file of markdownFiles(docs)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/!\[([^\]]*)\]\(([^)]*)\)|<img\b[^>]*>/gi)) {
        expect(match[0], `${relative(repoRoot, file)} image`).not.toMatch(banned);
      }
    }
    const images = readdirSync(docs, { recursive: true, withFileTypes: false }) as string[];
    expect(images.filter((path) => /\.(png|gif|webp)$/i.test(path) && banned.test(path))).toEqual([]);
  });

  it("validates the example pack against the validator and the shipped schema", () => {
    const pack = json("docs/snippets/avatar/blob-pack.json");
    const validate = new Ajv2020({ allErrors: true, strict: true, strictRequired: false }).compile(json("packages/core/schemas/avatar-pack.v1.schema.json"));
    expect(validate(pack), JSON.stringify(validate.errors)).toBe(true);
    const normalized = normalizePack(validatePack(pack), "https://x.test/avatars/blob/pack.json");
    expect(normalized.sheetUrl).toBe("https://x.test/avatars/blob/blob.png");
    expect(resolveRole(normalized, "greet")).toBe("wave");
    expect(normalized.stillOf("wave")).toBe(2);
    expect(normalized.stillOf("blink")).toBe(0);
  });

  it("rejects a pack with $schema, as the make-a-pack page says", () => {
    expect(() => validatePack({ ...json("docs/snippets/avatar/blob-pack.json"), $schema: "x" })).toThrow(/\$schema/);
  });

  it("converts the two example classic maps as the classic page describes", () => {
    const columnRow = json("docs/snippets/avatar/classic-column-row.json");
    const position = json("docs/snippets/avatar/classic-position.json");
    expect(detectClassicFormat(columnRow)).toBe("column-row");
    expect(detectClassicFormat(position)).toBe("position");
    const options = { sheetUrl: "https://x.test/map.png", frameSize: { w: 124, h: 93 } };
    const a = validatePack(fromClassicColumnRowMap(columnRow, options));
    expect(a.animations["Wave"]?.frames).toHaveLength(2);
    expect(a.roles.greet).toBe("Wave");
    expect(a.license?.name).toBe("unknown");
    const b = validatePack(fromClassicPositionMap(position, { sheetUrl: "https://x.test/map.png" }));
    expect(b.animations["Wave"]?.frames.map((frame) => frame.x)).toEqual([124, 248]);
    expect(b.animations["Wave"]?.loop).toBe(false);
  });
});
