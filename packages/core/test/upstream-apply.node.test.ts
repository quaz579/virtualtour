import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLASS_TABLE, KNOWN_POPOVER_CLASSES, main, rewriteClassStrings, rewritePatch, type RunResult } from "../../../tools/upstream-apply.mjs";
import { names } from "../src/engine/core/namespace";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const tool = join(repoRoot, "tools/upstream-apply.mjs");

function section(path: string, removed: string, added: string, context = "const keep = 1;"): string {
  return [
    `diff --git a/packages/driver/src/${path} b/packages/driver/src/${path}`,
    "index 1111111..2222222 100644",
    `--- a/packages/driver/src/${path}`,
    `+++ b/packages/driver/src/${path}`,
    "@@ -1,2 +1,2 @@",
    ` ${context}`,
    ...(removed ? [`-${removed}`] : []),
    `+${added}`,
    "",
  ].join("\n");
}

function formatPatch(...sections: string[]): string {
  return ["From 0123456789abcdef Mon Sep 17 00:00:00 2001", "Subject: [PATCH] fix", "", "---", ...sections].join("\n");
}

const utilsPatch = formatPatch(
  section("core/utils.ts", 'el.classList.add("driver-old");', 'el.classList.add("driver-popover-shiny", "driver-simple");', 'const tag = "[driver.js]";'),
);

describe("rewritePatch", () => {
  it("retargets engine paths and renames driver- class strings and the console prefix", () => {
    const result = rewritePatch(utilsPatch);
    expect(result.refused).toEqual([]);
    expect(result.patch).toContain("diff --git a/packages/core/src/engine/core/utils.ts b/packages/core/src/engine/core/utils.ts");
    expect(result.patch).toContain("--- a/packages/core/src/engine/core/utils.ts");
    expect(result.patch).toContain("+++ b/packages/core/src/engine/core/utils.ts");
    expect(result.patch).toContain('+el.classList.add("vt-popover-shiny", "vt-simple");');
    expect(result.patch).toContain('-el.classList.add("vt-old");');
    expect(result.patch).toContain('const tag = "[virtualtour]";');
    expect(result.patch).not.toMatch(/driver-|\[driver\.js\]|packages\/driver/);
  });

  it("maps state classes to the data attributes the engine uses", () => {
    const result = rewritePatch(formatPatch(section("tour/highlight.ts", "", 'el.classList.add("driver-active-element");')));
    expect(result.patch).toContain('+el.classList.add("data-vt-target");');
    expect(result.unmapped).toEqual(["driver-active-element"]);
  });

  it("reports class strings that are not in the table", () => {
    const result = rewritePatch(formatPatch(section("core/utils.ts", "", 'const c = "driver-brand-new";')));
    expect(result.patch).toContain('+const c = "vt-brand-new";');
    expect(result.unmapped).toEqual(["driver-brand-new"]);
  });

  it("does not touch hunk lines that merely start with a path-like prefix", () => {
    const result = rewritePatch(formatPatch(section("core/utils.ts", "-- a: 1", "-- b: 2")));
    expect(result.patch).toContain("--- a: 1");
    expect(result.patch).toContain("+-- b: 2");
  });

  it("handles CRLF patches and refuses unparseable diff headers", () => {
    const crlf = rewritePatch(formatPatch(section("hints.ts", "", "x")).replace(/\n/g, "\r\n"));
    expect(crlf.refused).toHaveLength(1);
    const quoted = rewritePatch(formatPatch('diff --git "a/packages/driver/src/my file.ts" "b/packages/driver/src/my file.ts"\n@@ -1 +1 @@\n-a\n+b\n'));
    expect(quoted.refused).toHaveLength(1);
    expect(quoted.patch).toBe("");
  });

  it("renames driver.css to engine.css", () => {
    const result = rewritePatch(formatPatch(section("styles/driver.css", "", ".driver-popover { color: red; }")));
    expect(result.patch).toContain("a/packages/core/src/engine/styles/engine.css");
    expect(result.patch).toContain("+.vt-popover { color: red; }");
  });

  it("drops sections outside the driver source and reports them", () => {
    const docs = ["diff --git a/apps/docs/changelog.mdx b/apps/docs/changelog.mdx", "--- a/apps/docs/changelog.mdx", "+++ b/apps/docs/changelog.mdx", "@@ -1 +1 @@", "-a", "+b", ""].join("\n");
    const result = rewritePatch(formatPatch(docs, section("core/utils.ts", "", "const x = 1;")));
    expect(result.skipped).toEqual(["apps/docs/changelog.mdx"]);
    expect(result.patch).not.toContain("changelog");
    expect(result.patch).toContain("engine/core/utils.ts");
  });

  it.each([
    ["hints.ts", "hints were removed"],
    ["checklist.ts", "checklists were removed"],
    ["styles/hints.css", "hint styles were removed"],
    ["styles/checklist.css", "checklist styles were removed"],
    ["styles/popover.css", "src/styles/base.css"],
  ])("refuses %s", (file, message) => {
    const result = rewritePatch(formatPatch(section("core/utils.ts", "", "const ok = 1;"), section(file, "", "x")));
    expect(result.patch).toBe("");
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.file).toBe(`packages/driver/src/${file}`);
    expect(result.refused[0]?.reason).toContain(message);
  });
});

describe("namespace table", () => {
  const dynamic = names("vt");
  const known = new Set<string>([
    ...Object.values(dynamic.attr),
    ...Object.entries(dynamic)
      .filter(([, value]) => typeof value === "string")
      .map(([, value]) => value as string),
    dynamic.layer,
    dynamic.liveRegion,
    dynamic.dummyId,
    dynamic.animationDurationVar.replace(/^--/, ""),
    dynamic.nudgeDurationVar.replace(/^--/, ""),
    dynamic.nudgeAnimationPrefix,
  ]);

  it("maps every entry onto a name the engine really defines", () => {
    for (const [from, to] of Object.entries(CLASS_TABLE)) {
      expect(from.startsWith("driver-")).toBe(true);
      expect(known.has(to), `${from} -> ${to}`).toBe(true);
    }
  });

  it("covers every dynamic class name by prefix substitution or table entry", () => {
    for (const to of [dynamic.active, dynamic.fade, dynamic.simple, dynamic.noScroll, dynamic.target, dynamic.overlay, dynamic.overlayAnimated]) {
      expect(to.startsWith("vt-")).toBe(true);
    }
    expect(CLASS_TABLE["driver-active"]).toBe(dynamic.attr.active);
    expect(CLASS_TABLE["driver-fade"]).toBe(dynamic.attr.fade);
    expect(CLASS_TABLE["driver-active-element"]).toBe(dynamic.attr.target);
    expect(CLASS_TABLE["driver-no-interaction"]).toBe(dynamic.attr.blocked);
    expect(CLASS_TABLE["driver-active-element-raised"]).toBe(dynamic.attr.raised);
    expect(CLASS_TABLE["driver-allowed-element"]).toBe(dynamic.attr.extra);
    expect(CLASS_TABLE["driver-active-element-parent"]).toBe(dynamic.attr.targetParent);
    expect(CLASS_TABLE["driver-overlay"]).toBe(dynamic.attr.overlay);
    expect(CLASS_TABLE["driver-no-scroll"]).toBe(dynamic.attr.lockScroll);
    expect(CLASS_TABLE["driver-simple"]).toBe(dynamic.simple);
    expect(CLASS_TABLE["driver-overlay-animated"]).toBe(dynamic.overlayAnimated);
  });

  it("lists every popover class the engine defines as known", () => {
    const strings = Object.values(dynamic.popover).filter(value => typeof value === "string") as string[];
    expect([...KNOWN_POPOVER_CLASSES].sort()).toEqual([...new Set([...strings.map(value => `driver-${value.slice(3)}`), "driver-popover-arrow-side-"])].sort());
    expect(rewritePatch(formatPatch(section("core/utils.ts", "", 'c("driver-popover-foo", "driver-popover-side-top")'))).unmapped).toEqual(["driver-popover-foo"]);
  });

  it("rewrites every popover class name the engine defines from its upstream spelling", () => {
    const strings = Object.values(dynamic.popover).filter(value => typeof value === "string") as string[];
    expect(strings.length).toBeGreaterThan(20);
    for (const value of strings) {
      expect(value.startsWith("vt-popover")).toBe(true);
      expect(rewriteClassStrings(`driver-${value.slice(3)}`)).toBe(value);
    }
  });
});

interface Call {
  command: string;
  args: string[];
  input?: string;
}

function fakeRun(overrides: Record<string, Partial<RunResult>> = {}, patch = utilsPatch) {
  const calls: Call[] = [];
  const run = (command: string, args: string[], options?: Record<string, unknown>): RunResult => {
    const call: Call = { command, args };
    if (typeof options?.["input"] === "string") call.input = options["input"];
    calls.push(call);
    const key = args.slice(0, 2).join(" ");
    const base: Record<string, RunResult> = {
      "remote get-url": { status: 0, stdout: "x" },
      "fetch upstream": { status: 0 },
      "format-patch -1": { status: 0, stdout: patch },
      "apply --3way": { status: 0, stdout: "" },
      "tag --contains": { status: 0, stdout: "1.13.0\n1.14.0\n" },
      "rev-parse abcdef1": { status: 0, stdout: "abcdef1234567890abcdef1234567890abcdef12\n" },
    };
    return { ...(base[key] ?? { status: 0, stdout: "" }), ...(overrides[key] ?? {}) };
  };
  return { calls, run };
}

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: (line: string) => out.push(line), error: (line: string) => err.push(line) };
}

describe("main", () => {
  it("prints the remote add line and stops when the upstream remote is missing", () => {
    const { calls, run } = fakeRun({ "remote get-url": { status: 2 } });
    const io = capture();
    expect(main(["abcdef1"], { run, ...io })).toBe(1);
    expect(io.err.join("\n")).toContain("git remote add upstream https://github.com/nilbuild/driver.js.git");
    expect(calls.map((call) => call.args[0])).toEqual(["remote"]);
  });

  it("fetches, rewrites, applies with --3way --index and prints the trailer without committing", () => {
    const { calls, run } = fakeRun();
    const io = capture();
    expect(main(["abcdef1"], { run, ...io })).toBe(0);
    expect(calls.map((call) => call.args.slice(0, 2).join(" "))).toEqual([
      "remote get-url",
      "fetch upstream",
      "format-patch -1",
      "apply --3way",
      "tag --contains",
      "rev-parse abcdef1",
    ]);
    const apply = calls.find((call) => call.args[0] === "apply");
    expect(apply?.args).toEqual(["apply", "--3way", "--index"]);
    expect(apply?.input).toContain("packages/core/src/engine/core/utils.ts");
    expect(calls.some((call) => call.args.includes("commit"))).toBe(false);
    expect(io.out).toContain("Upstream: abcdef1234567890abcdef1234567890abcdef12 (1.13.0)");
  });

  it("labels an untagged commit unreleased", () => {
    const { run } = fakeRun({ "tag --contains": { status: 0, stdout: "" } });
    const io = capture();
    main(["abcdef1"], { run, ...io });
    expect(io.out.at(-1)).toBe("Upstream: abcdef1234567890abcdef1234567890abcdef12 (unreleased)");
  });

  it("exits 2 for a patch touching a removed file and never applies", () => {
    const { calls, run } = fakeRun({}, formatPatch(section("hints.ts", "", "x")));
    const io = capture();
    expect(main(["abcdef1"], { run, ...io })).toBe(2);
    expect(io.err.join("\n")).toContain("refused: packages/driver/src/hints.ts");
    expect(calls.some((call) => call.args[0] === "apply")).toBe(false);
  });

  it("names src/styles/base.css when refusing popover.css", () => {
    const { run } = fakeRun({}, formatPatch(section("styles/popover.css", "", "x")));
    const io = capture();
    expect(main(["abcdef1"], { run, ...io })).toBe(2);
    expect(io.err.join("\n")).toContain("src/styles/base.css");
  });

  it("leaves conflicts to the maintainer: non-zero exit, trailer still printed", () => {
    const { run } = fakeRun({ "apply --3way": { status: 1, stderr: "error: patch failed" } });
    const io = capture();
    expect(main(["abcdef1"], { run, ...io })).toBe(1);
    expect(io.err.join("\n")).toContain("did not apply cleanly");
    expect(io.out.at(-1)).toContain("Upstream: abcdef1234567890abcdef1234567890abcdef12");
  });

  it("--dry-run prints the rewritten patch and applies nothing", () => {
    const { calls, run } = fakeRun();
    const io = capture();
    expect(main(["abcdef1", "--dry-run"], { run, ...io })).toBe(0);
    expect(calls.some((call) => call.args[0] === "apply")).toBe(false);
    expect(io.out.join("\n")).toContain("vt-popover-shiny");
  });

  it("rejects a missing or malformed sha", () => {
    const { calls, run } = fakeRun();
    const io = capture();
    expect(main([], { run, ...io })).toBe(1);
    expect(main(["--dry-run"], { run, ...io })).toBe(1);
    expect(main(["not-a-sha"], { run, ...io })).toBe(1);
    expect(calls).toEqual([]);
  });

  it("refuses a patch with nothing under the driver source", () => {
    const docs = ["diff --git a/readme.md b/readme.md", "--- a/readme.md", "+++ b/readme.md", "@@ -1 +1 @@", "-a", "+b", ""].join("\n");
    const { calls, run } = fakeRun({}, formatPatch(docs));
    const io = capture();
    expect(main(["abcdef1"], { run, ...io })).toBe(1);
    expect(calls.some((call) => call.args[0] === "apply")).toBe(false);
  });
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function write(root: string, file: string, text: string) {
  const full = join(root, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

describe("end to end against local repositories", () => {
  it("stages a rewritten upstream fix in the fork without committing", () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "upstream-apply-")));
    const upstream = join(base, "upstream");
    const fork = join(base, "fork");
    mkdirSync(upstream);
    mkdirSync(fork);
    const before = ['const tag = "[driver.js]";', "export const a = 1;", "export const b = 2;", ""].join("\n");

    git(upstream, "init", "-q", "-b", "main");
    write(upstream, "packages/driver/src/core/utils.ts", before);
    git(upstream, "add", "-A");
    git(upstream, "commit", "-q", "-m", "base");
    write(upstream, "packages/driver/src/core/utils.ts", before.replace("export const b = 2;", 'export const b = "driver-popover-shiny";'));
    write(upstream, "apps/docs/changelog.mdx", "fixed\n");
    git(upstream, "add", "-A");
    git(upstream, "commit", "-q", "-m", "fix");
    git(upstream, "tag", "9.9.9");
    const sha = git(upstream, "rev-parse", "HEAD");

    git(fork, "init", "-q", "-b", "main");
    write(fork, "packages/core/src/engine/core/utils.ts", before.replace("[driver.js]", "[virtualtour]"));
    git(fork, "add", "-A");
    git(fork, "commit", "-q", "-m", "fork base");
    const head = git(fork, "rev-parse", "HEAD");
    git(fork, "remote", "add", "upstream", upstream);

    const run = spawnSync("node", [tool, sha], { cwd: fork, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain(`Upstream: ${sha} (9.9.9)`);
    expect(git(fork, "rev-parse", "HEAD")).toBe(head);
    expect(git(fork, "diff", "--cached", "--name-only")).toBe("packages/core/src/engine/core/utils.ts");
    expect(readFileSync(join(fork, "packages/core/src/engine/core/utils.ts"), "utf8")).toContain('export const b = "vt-popover-shiny";');
  });

  it("exits 2 and leaves the fork untouched for a removed file", () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "upstream-apply-")));
    const upstream = join(base, "upstream");
    const fork = join(base, "fork");
    mkdirSync(upstream);
    mkdirSync(fork);

    git(upstream, "init", "-q", "-b", "main");
    write(upstream, "packages/driver/src/hints.ts", "a\n");
    git(upstream, "add", "-A");
    git(upstream, "commit", "-q", "-m", "base");
    write(upstream, "packages/driver/src/hints.ts", "b\n");
    git(upstream, "add", "-A");
    git(upstream, "commit", "-q", "-m", "hint fix");
    const sha = git(upstream, "rev-parse", "HEAD");

    git(fork, "init", "-q", "-b", "main");
    write(fork, "keep.txt", "x\n");
    git(fork, "add", "-A");
    git(fork, "commit", "-q", "-m", "fork base");
    git(fork, "remote", "add", "upstream", upstream);

    const run = spawnSync("node", [tool, sha], { cwd: fork, encoding: "utf8" });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("hints were removed");
    expect(git(fork, "status", "--porcelain")).toBe("");
  });
});
