import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { names } from "../../src/engine/core/namespace";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const coreDir = join(repoRoot, "packages/core");
const forkPoint = "0163642dc532417ea401684bd26690e2f3283d63";
const page = readFileSync(join(repoRoot, "docs/migration/from-driverjs.md"), "utf8");

const upstreamTypes = readFileSync(join(coreDir, "test/fixtures/driverjs-1.12.1-types.txt"), "utf8");
const upstreamClasses = readFileSync(join(coreDir, "test/fixtures/driverjs-1.12.1-classes.txt"), "utf8")
  .split("\n")
  .filter(Boolean);

function section(heading: string): string[][] {
  const lines = page.split("\n");
  const start = lines.findIndex((line) => line === `## ${heading}`);
  expect(start, `heading "${heading}" in the migration page`).toBeGreaterThanOrEqual(0);
  const rows: string[][] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    if (!line.startsWith("|") || /^\|[\s|-]+\|?$/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    rows.push(cells);
  }
  return rows.slice(1);
}

function tokens(cell: string | undefined): string[] {
  return [...(cell ?? "").matchAll(/`([^`]+)`/g)].map((match) => match[1] as string);
}

function upstreamKeys(): { all: Set<string>; popover: Set<string> } {
  const file = ts.createSourceFile("types.ts", upstreamTypes, ts.ScriptTarget.ES2020, true);
  const groups = new Map<string, Set<string>>();
  for (const statement of file.statements) {
    let members: readonly ts.TypeElement[] | undefined;
    let name: string | undefined;
    if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
      name = statement.name.text;
      members = statement.type.members;
    } else if (ts.isInterfaceDeclaration(statement)) {
      name = statement.name.text;
      members = statement.members;
    }
    if (!name || !members) continue;
    const keys = new Set<string>();
    for (const member of members) {
      if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) keys.add(member.name.text);
    }
    groups.set(name, keys);
  }
  const all = new Set<string>();
  for (const group of ["Config", "Popover", "DriveStep", "Driver"]) {
    const keys = groups.get(group);
    expect(keys, `upstream ${group}`).toBeDefined();
    for (const key of keys ?? []) all.add(key);
  }
  return { all, popover: groups.get("Popover") as Set<string> };
}

function publicApi() {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const entry = join(coreDir, "src/index.ts");
  const program = ts.createProgram([entry], options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry) as ts.SourceFile;
  const moduleSymbol = checker.getSymbolAtLocation(source) as ts.Symbol;
  const exported = new Map(checker.getExportsOfModule(moduleSymbol).map((symbol) => [symbol.getName(), symbol]));

  function typeOf(name: string): ts.Type {
    let symbol = exported.get(name);
    expect(symbol, `export ${name}`).toBeDefined();
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return checker.getDeclaredTypeOfSymbol(symbol as ts.Symbol);
  }

  function member(type: ts.Type, key: string): ts.Type | undefined {
    const base = checker.getNonNullableType(type);
    const candidates = base.isUnion() ? base.types : [base];
    for (const candidate of candidates) {
      const prop = candidate.getProperty(key);
      if (prop) return checker.getNonNullableType(checker.getTypeOfSymbol(prop));
    }
    return undefined;
  }

  function element(type: ts.Type): ts.Type | undefined {
    const base = checker.getNonNullableType(type);
    return checker.getIndexTypeOfType(base, ts.IndexKind.Number);
  }

  function resolve(root: ts.Type, path: string): boolean {
    let current: ts.Type | undefined = root;
    for (const raw of path.split(".")) {
      if (!current) return false;
      const isList = raw.endsWith("[]");
      const key = raw.replace(/\(\)$/, "").replace(/\[\]$/, "");
      current = member(current, key);
      if (current && isList) current = element(current);
    }
    return current !== undefined;
  }

  return {
    exists(token: string): boolean {
      const event = /^(tour|step)\.on\("([^"]+)"\)$/.exec(token);
      if (event) return member(typeOf(event[1] === "tour" ? "TourEvents" : "StepEvents"), event[2] as string) !== undefined;
      if (token.startsWith("tour.")) return resolve(typeOf("Tour"), token.slice(5));
      if (token.startsWith("step.")) return resolve(typeOf("TourStep"), token.slice(5));
      if (token.startsWith("steps[].")) return resolve(typeOf("StepConfig"), token.slice(8));
      return resolve(typeOf("TourConfig"), token);
    },
  };
}

describe("migration page tables", () => {
  const optionRows = section("Options");
  const hookRows = section("Hooks and methods");
  const classRows = section("Class names");

  it("parses all three tables", () => {
    expect(optionRows.length).toBeGreaterThan(30);
    expect(hookRows.length).toBeGreaterThan(30);
    expect(classRows.length).toBeGreaterThan(10);
  });

  const forkPointAvailable = spawnSync("git", ["cat-file", "-e", `${forkPoint}^{commit}`], { cwd: repoRoot }).status === 0;

  it.skipIf(!forkPointAvailable)("the vendored upstream types are the fork-point file", () => {
    const shown = spawnSync("git", ["show", `${forkPoint}:packages/driver/src/types.ts`], { cwd: repoRoot, encoding: "utf8" });
    expect(upstreamTypes).toBe(shown.stdout);
  });

  it("every driver.js name in the left column exists in driver.js 1.12.1", () => {
    const { all, popover } = upstreamKeys();
    for (const row of [...optionRows, ...hookRows]) {
      const found = tokens(row[0]);
      expect(found.length, `row ${row.join(" | ")}`).toBeGreaterThan(0);
      for (const token of found) {
        if (token.startsWith("popover.")) expect(popover.has(token.slice(8)), token).toBe(true);
        else expect(all.has(token), token).toBe(true);
      }
    }
  });

  it("covers every driver.js option, hook and method", () => {
    const { all } = upstreamKeys();
    const covered = new Set(
      [...optionRows, ...hookRows].flatMap((row) => tokens(row[0]).map((token) => token.replace(/^popover\./, "")))
    );
    const missing = [...all].filter((key) => key !== "popover" && !covered.has(key));
    expect(missing).toEqual([]);
  });

  it("every VirtualTour name in the right column exists in the public types", { timeout: 120_000 }, () => {
    const api = publicApi();
    for (const row of [...optionRows, ...hookRows]) {
      for (const token of tokens(row[1])) {
        expect(api.exists(token), `${row[0]} -> ${token}`).toBe(true);
      }
    }
  });

  it("class names: the left column is driver.js's, the right column is ours", () => {
    const n = names("vt");
    const candidates = new Set<string>();
    const collect = (value: unknown): void => {
      if (typeof value === "string") candidates.add(value);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };
    collect(n);
    for (const side of ["top", "bottom", "left", "right", "center", "over"]) {
      candidates.add(n.popover.sideClass(side));
      candidates.add(n.popover.arrowSideClass(side));
    }
    for (const align of ["start", "center", "end"]) candidates.add(n.popover.alignClass(align));
    const attributes = new Set<string>(Object.values(n.attr));

    const mapped = new Set<string>();
    for (const row of classRows) {
      const left = tokens(row[0]);
      const right = tokens(row[1]);
      expect(left.length, `row ${row.join(" | ")}`).toBe(1);
      expect(right.length, `row ${row.join(" | ")}`).toBe(1);
      const from = left[0] as string;
      const to = right[0] as string;

      if (from.endsWith("*")) {
        const prefix = from.slice(1, -1);
        const group = upstreamClasses.filter((name) => name.startsWith(prefix));
        expect(group.length, from).toBeGreaterThan(0);
        for (const name of group) {
          mapped.add(name);
          expect(candidates.has(name.replace(/^driver-/, "vt-")), name).toBe(true);
        }
        expect(to.startsWith(".vt-") && to.endsWith("*"), to).toBe(true);
      } else {
        expect(from.startsWith("."), from).toBe(true);
        expect(upstreamClasses, from).toContain(from.slice(1));
        mapped.add(from.slice(1));
        if (to.startsWith("[")) expect(attributes.has(to.slice(1, -1)), to).toBe(true);
        else expect(candidates.has(to.slice(1)), to).toBe(true);
      }
    }
    expect(upstreamClasses.filter((name) => !mapped.has(name))).toEqual([]);
  });
});
