import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const freezeFile = join(root, "API-FREEZE.md");

const entries: Record<string, string> = {
  virtualtour: "src/index.ts",
  "virtualtour/avatar": "src/avatar/index.ts",
  "virtualtour/motion": "src/motion/index.ts",
};

const HEADER = `# API freeze for 1.0

Every name exported from each public entry point, with its kind. Adding, removing, renaming or changing the kind of an export fails \`test/api-freeze.node.test.ts\` until this file is updated on purpose. Regenerate it with \`UPDATE_API_FREEZE=1 npm test -- test/api-freeze.node.test.ts\`.

Member-level shape (fields of a config type, method signatures) is covered by the type tests and the published declaration check, not by this list.
`;

function kindOf(symbol: ts.Symbol): string {
  const flags = symbol.flags;
  if (flags & ts.SymbolFlags.Class) return "class";
  if (flags & ts.SymbolFlags.Function) return "function";
  if (flags & ts.SymbolFlags.Enum) return "enum";
  if (flags & ts.SymbolFlags.Interface) return "interface";
  if (flags & ts.SymbolFlags.TypeAlias) return "type";
  if (flags & ts.SymbolFlags.Variable) return "const";
  return "other";
}

function surface(): Record<string, string[]> {
  const configPath = join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const rootNames = Object.values(entries).map((entry) => join(root, entry));
  const program = ts.createProgram({ rootNames, options: parsed.options });
  const checker = program.getTypeChecker();
  const result: Record<string, string[]> = {};
  for (const [name, entry] of Object.entries(entries)) {
    const source = program.getSourceFile(join(root, entry));
    const moduleSymbol = source && checker.getSymbolAtLocation(source);
    if (!moduleSymbol) throw new Error(`cannot resolve ${entry}`);
    result[name] = checker
      .getExportsOfModule(moduleSymbol)
      .map((symbol) => {
        const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
        return `- \`${symbol.name}\` (${kindOf(target)})`;
      })
      .sort();
  }
  return result;
}

function render(current: Record<string, string[]>): string {
  const sections = Object.entries(current).map(([name, lines]) => `## ${name}\n\n${lines.join("\n")}\n`);
  return `${HEADER}\n${sections.join("\n")}`;
}

function parse(text: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let section = "";
  for (const line of text.split("\n")) {
    const heading = /^## (\S+)$/.exec(line);
    if (heading) {
      section = heading[1]!;
      result[section] = [];
    } else if (section && line.startsWith("- ")) {
      result[section]!.push(line);
    }
  }
  return result;
}

describe("API freeze", () => {
  const current = surface();

  it("covers every entry point with a non-empty list", () => {
    for (const name of Object.keys(entries)) {
      expect(current[name]!.length, name).toBeGreaterThan(0);
    }
  });

  it("includes type-only exports re-exported with export type *", () => {
    expect(current["virtualtour"]).toContain("- `TourConfig` (interface)");
  });

  it("API-FREEZE.md lists exactly the exports of each entry point", () => {
    if (process.env["UPDATE_API_FREEZE"]) {
      if (process.env["CI"]) throw new Error("UPDATE_API_FREEZE must not be set in CI");
      writeFileSync(freezeFile, render(current));
    }
    expect(parse(readFileSync(freezeFile, "utf8"))).toEqual(current);
  });

  it("detects an added and a removed export", () => {
    const listed = parse(render(current));
    const added = { ...current, virtualtour: [...current["virtualtour"]!, "- `extra` (const)"] };
    const removed = { ...current, virtualtour: current["virtualtour"]!.slice(1) };
    expect(listed).not.toEqual(added);
    expect(listed).not.toEqual(removed);
  });
});
