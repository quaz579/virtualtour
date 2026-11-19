import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(root, "../..");
const read = (path: string) => readFileSync(join(repo, path), "utf8");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(join(dir, entry.name)) : /\.(ts|tsx|css)$/.test(entry.name) ? [join(dir, entry.name)] : [],
  );
}

describe("release readiness", () => {
  it("keeps the three package versions equal", () => {
    const versions = ["core", "react", "vue"].map((name) => (JSON.parse(read(`packages/${name}/package.json`)) as { version: string }).version);
    expect(new Set(versions).size).toBe(1);
  });

  it("leaves no driver- class string in src", () => {
    const hits = sources(join(root, "src")).filter((file) => /driver-/.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });

  it("carries both copyright lines in every LICENSE", () => {
    for (const path of ["LICENSE", "packages/core/LICENSE", "packages/react/LICENSE", "packages/vue/LICENSE"]) {
      const text = read(path);
      expect(text, path).toContain("Copyright (c) Kamran Ahmed");
      expect(text, path).toMatch(/Copyright \(c\) \d{4} VirtualTour contributors/);
    }
  });

  it("names the fork point in both NOTICE files and the changelog", () => {
    const tag = "`1.12.1`";
    const commit = "0163642dc532417ea401684bd26690e2f3283d63";
    for (const path of ["NOTICE.md", "packages/core/NOTICE.md"]) {
      expect(read(path), path).toContain(tag);
      expect(read(path), path).toContain(commit);
    }
    expect(read("packages/core/CHANGELOG.md")).toMatch(/derived from driver\.js 1\.12\.1/);
  });

  it("lists every checklist item from the release task", () => {
    const checklist = read("RELEASE-CHECKLIST.md");
    const boxes = checklist.split("\n").filter((line) => /^- \[[ x]\] /.test(line));
    expect(boxes.length).toBeGreaterThanOrEqual(15);
    for (const phrase of ["LICENSE", "NOTICE.md", "UPSTREAM.md", "legal review", "four engines", "SSR", "size report", "accessibility", "screen-reader", "link check", "driver-"]) {
      expect(checklist.toLowerCase(), phrase).toContain(phrase.toLowerCase());
    }
  });
});
