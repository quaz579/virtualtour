import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const UPSTREAM_URL = "https://github.com/nilbuild/driver.js.git";
export const UPSTREAM_SRC = "packages/driver/src/";
export const ENGINE_SRC = "packages/core/src/engine/";

export const REFUSED_FILES = [
  { path: "hints.ts", reason: "hints were removed from the fork" },
  { path: "checklist.ts", reason: "checklists were removed from the fork" },
  { path: "styles/hints.css", reason: "hint styles were removed from the fork" },
  { path: "styles/checklist.css", reason: "checklist styles were removed from the fork" },
  {
    path: "styles/popover.css",
    reason: "popover styles moved to packages/core/src/styles/base.css (src/styles/base.css) with renamed classes; port the change there by hand",
  },
];

const RENAMED_FILES = new Map([["styles/driver.css", "styles/engine.css"]]);

export const CLASS_TABLE = Object.freeze({
  "driver-active": "data-vt-active",
  "driver-fade": "data-vt-fade",
  "driver-no-scroll": "data-vt-lock-scroll",
  "driver-active-element": "data-vt-target",
  "driver-no-interaction": "data-vt-blocked",
  "driver-active-element-raised": "data-vt-raised",
  "driver-allowed-element": "data-vt-extra",
  "driver-active-element-parent": "data-vt-target-parent",
  "driver-active-element-parent-no-scroll": "data-vt-lock-scroll",
  "driver-overlay": "data-vt-overlay",
  "driver-simple": "vt-simple",
  "driver-overlay-animated": "vt-overlay-animated",
  "driver-layer": "vt-layer",
  "driver-live-region": "vt-live-region",
  "driver-dummy-element": "vt-dummy-element",
  "driver-animation-duration": "vt-animation-duration",
  "driver-nudge-duration": "vt-nudge-duration",
  "driver-nudge": "vt-nudge",
});

const DRIVER_TOKEN = /(?<![A-Za-z0-9_-])driver-[A-Za-z0-9_-]*[A-Za-z0-9_]|(?<![A-Za-z0-9_-])driver-(?![A-Za-z0-9_-])/g;

export function rewriteClassStrings(text, unmapped = new Set()) {
  return text
    .replace(DRIVER_TOKEN, (token) => {
      if (Object.hasOwn(CLASS_TABLE, token)) return CLASS_TABLE[token];
      if (!token.startsWith("driver-popover")) unmapped.add(token);
      return `vt-${token.slice("driver-".length)}`;
    })
    .replaceAll("[driver.js]", "[virtualtour]");
}

function splitSections(patch) {
  const lines = patch.split("\n");
  const head = [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      current = [line];
      sections.push(current);
    } else if (current) {
      current.push(line);
    } else {
      head.push(line);
    }
  }
  return { head, sections };
}

function sectionPaths(section) {
  const match = /^diff --git a\/(\S+) b\/(\S+)$/.exec(section[0]);
  return match ? { from: match[1], to: match[2] } : null;
}

function mapPath(path) {
  const rest = path.slice(UPSTREAM_SRC.length);
  return `${ENGINE_SRC}${RENAMED_FILES.get(rest) ?? rest}`;
}

const PATH_LINE = /^(diff --git |--- |\+\+\+ |rename from |rename to |copy from |copy to )/;

function rewritePathLine(line) {
  return line.replace(/(a\/|b\/|^rename from |^rename to |^copy from |^copy to )(packages\/driver\/src\/\S+)/g, (_all, prefix, path) => `${prefix}${mapPath(path)}`);
}

/**
 * Rewrites an upstream `git format-patch` into one that applies to the fork.
 * Sections outside `packages/driver/src/` are dropped and listed in `skipped`; sections that touch removed or moved files are listed in `refused`.
 * @param {string} patch
 * @returns {{ patch: string, refused: { file: string, reason: string }[], skipped: string[], unmapped: string[] }}
 */
export function rewritePatch(patch) {
  const { head, sections } = splitSections(patch);
  const refused = [];
  const skipped = [];
  const kept = [];
  const unmapped = new Set();

  for (const section of sections) {
    const paths = sectionPaths(section);
    const touched = paths ? [paths.from, paths.to] : [];
    const inSrc = touched.filter((path) => path.startsWith(UPSTREAM_SRC));
    if (inSrc.length === 0) {
      skipped.push(paths?.to ?? section[0]);
      continue;
    }
    const blocked = REFUSED_FILES.find((entry) => inSrc.some((path) => path.slice(UPSTREAM_SRC.length) === entry.path));
    if (blocked) {
      refused.push({ file: `${UPSTREAM_SRC}${blocked.path}`, reason: blocked.reason });
      continue;
    }
    let inHunk = false;
    kept.push(
      section.map((line) => {
        if (!inHunk && PATH_LINE.test(line)) return rewritePathLine(line);
        if (line.startsWith("@@")) {
          inHunk = true;
          const end = line.indexOf("@@", 2);
          return line.slice(0, end + 2) + rewriteClassStrings(line.slice(end + 2), unmapped);
        }
        if (inHunk && (line.startsWith("+") || line.startsWith("-") || line.startsWith(" "))) {
          return line[0] + rewriteClassStrings(line.slice(1), unmapped);
        }
        return line;
      }),
    );
  }

  const body = kept.map((section) => section.join("\n")).join("\n");
  const out = refused.length > 0 || kept.length === 0 ? "" : [...head.filter((line) => !line.startsWith("diff --git ")), body].join("\n");
  return { patch: out, refused, skipped, unmapped: [...unmapped].sort() };
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options });
}

/**
 * Applies one upstream commit to the working tree and index, never committing.
 * Exit codes: 0 applied, 1 usage or git failure (including conflicts left in the tree), 2 refused.
 * @param {string[]} argv
 * @param {{ run?: typeof run, log?: (line: string) => void, error?: (line: string) => void }} [io]
 * @returns {number}
 */
export function main(argv, io = {}) {
  const exec = io.run ?? run;
  const log = io.log ?? console.log;
  const error = io.error ?? console.error;
  const sha = argv.find((arg) => !arg.startsWith("--"));
  const dryRun = argv.includes("--dry-run");

  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    error("usage: node tools/upstream-apply.mjs <upstream-sha> [--dry-run]");
    return 1;
  }

  const remote = exec("git", ["remote", "get-url", "upstream"]);
  if (remote.status !== 0) {
    error("The `upstream` remote does not exist. Add it with:");
    error(`  git remote add upstream ${UPSTREAM_URL}`);
    return 1;
  }

  const fetched = exec("git", ["fetch", "upstream", "--tags"], { stdio: ["ignore", "inherit", "inherit"] });
  if (fetched.status !== 0) {
    error("git fetch upstream failed");
    return 1;
  }

  const formatted = exec("git", ["format-patch", "-1", sha, "--stdout"]);
  if (formatted.status !== 0 || !formatted.stdout) {
    error(`could not format a patch for ${sha}: ${(formatted.stderr ?? "").trim()}`);
    return 1;
  }

  const result = rewritePatch(formatted.stdout);
  if (result.refused.length > 0) {
    for (const entry of result.refused) error(`refused: ${entry.file}: ${entry.reason}`);
    return 2;
  }
  if (result.patch === "") {
    error(`${sha} touches nothing under ${UPSTREAM_SRC}; nothing to apply`);
    return 1;
  }
  if (result.skipped.length > 0) log(`skipped (outside ${UPSTREAM_SRC}): ${result.skipped.join(", ")}`);
  if (result.unmapped.length > 0) {
    log(`class strings not in the namespace table, renamed by prefix only (check packages/core/src/engine/core/namespace.ts): ${result.unmapped.join(", ")}`);
  }

  if (dryRun) {
    log(result.patch);
    return 0;
  }

  const applied = exec("git", ["apply", "--3way", "--index"], { input: result.patch });
  if (applied.stdout) log(applied.stdout.trimEnd());
  if (applied.stderr) error(applied.stderr.trimEnd());
  if (applied.status !== 0) {
    error("The patch did not apply cleanly. Resolve the conflicts, then add the trailer below to the commit message.");
  }

  const tags = exec("git", ["tag", "--contains", sha, "--sort=creatordate"]);
  const version = (tags.stdout ?? "").split("\n").find((tag) => tag !== "") ?? "unreleased";
  const full = exec("git", ["rev-parse", sha]);
  log(`Upstream: ${(full.stdout ?? "").trim() || sha} (${version})`);
  return applied.status === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
