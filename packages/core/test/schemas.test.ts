import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parseTourJson } from "../src/index";
import type { TourJsonHandler } from "../src/index";
import { buildTestPack } from "../tools/make-test-pack.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const repo = resolve(root, "../..");
const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const tourSchema = read(join(root, "schemas/tour.v1.schema.json")) as Record<string, unknown>;
const avatarSchema = read(join(root, "schemas/avatar-pack.v1.schema.json")) as Record<string, unknown>;
const ajv = () => new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const validateTour = ajv().compile(tourSchema);
const validateAvatar = ajv().compile(avatarSchema);

const examplesDir = join(repo, "docs/examples/tours");
const exampleFiles = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));

function handlerNamesIn(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => handlerNamesIn(v, into));
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["handler"] === "string") into.add(record["handler"]);
    Object.values(record).forEach((v) => handlerNamesIn(v, into));
  }
  return into;
}

function handlersFor(doc: unknown): Record<string, TourJsonHandler> {
  return Object.fromEntries([...handlerNamesIn(doc)].map((name) => [name, () => undefined]));
}

function parses(doc: unknown): boolean {
  try {
    parseTourJson(doc, { handlers: handlersFor(doc) });
    return true;
  } catch {
    return false;
  }
}

function schemaNodes(node: unknown, path: string, into: [string, Record<string, unknown>][] = []): [string, Record<string, unknown>][] {
  if (!node || typeof node !== "object") return into;
  const record = node as Record<string, unknown>;
  for (const group of ["properties", "$defs"]) {
    const entries = record[group];
    if (entries && typeof entries === "object") {
      for (const [key, child] of Object.entries(entries)) {
        into.push([`${path}/${group}/${key}`, child as Record<string, unknown>]);
        schemaNodes(child, `${path}/${group}/${key}`, into);
      }
    }
  }
  for (const key of ["items", "oneOf", "not", "additionalProperties"]) {
    const child = record[key];
    if (Array.isArray(child)) child.forEach((c, i) => schemaNodes(c, `${path}/${key}/${i}`, into));
    else schemaNodes(child, `${path}/${key}`, into);
  }
  return into;
}

describe("schema files", () => {
  it.each([
    ["tour.v1.schema.json", tourSchema, "virtualtour-tour.v1.schema.json"],
    ["avatar-pack.v1.schema.json", avatarSchema, "virtualtour-avatar-pack.v1.schema.json"],
  ] as const)("%s declares 2020-12, an id, a title and a description", (_file, schema, id) => {
    expect(schema["$schema"]).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema["$id"]).toBe(id);
    expect(schema["title"]).toBeTypeOf("string");
    expect(schema["description"]).toBeTypeOf("string");
  });

  it.each([
    ["tour", tourSchema],
    ["avatar pack", avatarSchema],
  ] as const)("every property and definition of the %s schema has a title and a description", (_name, schema) => {
    const nodes = schemaNodes(schema, "#");
    expect(nodes.length).toBeGreaterThan(10);
    for (const [path, node] of nodes) {
      expect(node["title"], `${path} title`).toBeTypeOf("string");
      expect(node["description"], `${path} description`).toBeTypeOf("string");
      expect((node["description"] as string).length, `${path} description`).toBeGreaterThan(5);
    }
  });
});

describe("conformance", () => {
  it("has at least three example documents", () => {
    expect(exampleFiles.length).toBeGreaterThanOrEqual(3);
  });

  it.each(exampleFiles)("example %s validates against the tour schema and parses", (file) => {
    const doc = read(join(examplesDir, file));
    expect(validateTour(doc), JSON.stringify(validateTour.errors)).toBe(true);
    expect(parses(doc)).toBe(true);
  });

  it("the Thumbtack pack validates against the avatar schema", () => {
    const pack = read(join(root, "src/avatar/thumbtack/pack.json"));
    expect(validateAvatar(pack), JSON.stringify(validateAvatar.errors)).toBe(true);
  });

  it("the synthetic test pack validates against the avatar schema", () => {
    const pack = JSON.parse(buildTestPack().get("pack.json")!.toString("utf8")) as unknown;
    expect(validateAvatar(pack), JSON.stringify(validateAvatar.errors)).toBe(true);
  });
});

const ok = { format: "virtualtour-tour/1", steps: [] };
const step = (extra: Record<string, unknown>) => ({ ...ok, steps: [extra] });

const malformed: [string, unknown, string][] = [
  ["wrong format", { ...ok, format: "virtualtour-tour/2" }, "const"],
  ["missing steps", { format: "virtualtour-tour/1" }, "required"],
  ["unknown top-level key", { ...ok, typo: true }, "additionalProperties"],
  ["steps not an array", { ...ok, steps: {} }, "type"],
  ["unknown step key", step({ titel: "x" }), "additionalProperties"],
  ["invalid placement side", step({ placement: { side: "diagonal" } }), "enum"],
  ["offset with an unknown key", step({ position: { offset: { main: 1, sideways: 2 } } }), "additionalProperties"],
  ["handler object without a name", step({ prepare: {} }), "required"],
  ["dim opacity above 1", { ...ok, dim: { opacity: 2 } }, "maximum"],
  ["invalid namespace", { ...ok, namespace: "1bad" }, "pattern"],
  ["button action not a built-in or handler", step({ buttons: [{ text: "x", action: "explode" }] }), "enum"],
  ["negative waitFor", step({ waitFor: -1 }), "minimum"],
];

const extraMalformed: [string, unknown, string][] = [
  ["id in stepDefaults", { ...ok, stepDefaults: { id: "x" } }, "not"],
  ["negative corner radius", { ...ok, dim: { radius: { topLeft: -1 } } }, "minimum"],
  ["body list with a number", step({ body: ["a", 2] }), "type"],
  ["exitPrompt true", { ...ok, exitPrompt: true }, "const"],
  ["button without an action", step({ buttons: [{ text: "x" }] }), "required"],
  ["extensions array", step({ extensions: [] }), "type"],
  ["handler with an extra key", step({ shouldShow: { handler: "a", extra: 1 } }), "additionalProperties"],
  ["negative viewportPadding", step({ position: { viewportPadding: -1 } }), "minimum"],
  ["negative arrow minInset", step({ position: { arrow: { minInset: -1 } } }), "minimum"],
  ["extra selector that is not a string", step({ spotlight: { extra: ["#a", 3] } }), "type"],
  ["negative hookTimeout", step({ hookTimeout: -1 }), "minimum"],
  ["invalid targetInteractive string", step({ spotlight: { targetInteractive: "click-only" } }), "const"],
  ["autoAdvance without an event", step({ autoAdvance: { selector: "#a" } }), "required"],
];

describe("malformed fixtures", () => {
  it("has twelve primary fixtures", () => {
    expect(malformed).toHaveLength(12);
  });

  it.each([...malformed, ...extraMalformed])("%s fails the schema with %s and fails the parser", (_name, doc, keyword) => {
    expect(validateTour(doc)).toBe(false);
    expect(validateTour.errors!.map((e) => e.keyword)).toContain(keyword);
    expect(parses(doc)).toBe(false);
  });

  it.each([
    ["minimal", ok],
    ["empty stepDefaults", { ...ok, stepDefaults: {} }],
    ["exitPrompt false", { ...ok, exitPrompt: false }],
    ["placement auto", step({ placement: "auto" })],
    ["reveal as scroll options", step({ reveal: { behavior: "instant", block: "nearest" } })],
    ["body list", step({ body: [] })],
    ["meta any value", step({ meta: [null, 1, "x", { a: [] }] })],
    ["extensions object", step({ extensions: { a: { b: 1 } } })],
    ["targetInteractive hover-only", step({ spotlight: { targetInteractive: "hover-only" } })],
    ["a schema reference", { $schema: "x.json", ...ok }],
  ])("the schema and the parser both accept %s", (_name, doc) => {
    expect(validateTour(doc), JSON.stringify(validateTour.errors)).toBe(true);
    expect(parses(doc)).toBe(true);
  });
});

describe("key coverage", () => {
  const types = readFileSync(join(root, "src/types.ts"), "utf8");
  const interfaceKeys = (name: string): string[] => {
    const start = types.indexOf(`export interface ${name} {`);
    const end = types.indexOf("\n}\n", start);
    return [...types.slice(start, end).matchAll(/^  (\w+)\??:/gm)].map((m) => m[1]!);
  };
  const guide = readFileSync(join(repo, "docs/guide/json-tours.md"), "utf8");
  const codeOnly = (): string[] => {
    const from = guide.indexOf("## Code-only keys");
    const section = guide.slice(from, guide.indexOf("\n## ", from + 1));
    return [...section.matchAll(/^- `(\w+)`/gm)].map((m) => m[1]!);
  };
  const defs = tourSchema["$defs"] as Record<string, { properties: Record<string, unknown> }>;
  const topKeys = Object.keys(tourSchema["properties"] as object);
  const stepKeys = Object.keys(defs["step"]!.properties);

  it("finds the key lists", () => {
    expect(interfaceKeys("StepConfig")).toContain("autoAdvance");
    expect(interfaceKeys("TourConfig")).toContain("waitBudget");
    expect(codeOnly()).toEqual(expect.arrayContaining(["body", "mountIn"]));
  });

  it("every StepConfig key is in the schema or the code-only list", () => {
    for (const key of interfaceKeys("StepConfig")) expect([...stepKeys, ...codeOnly()], key).toContain(key);
  });

  it("every TourConfig key is in the schema or the code-only list", () => {
    for (const key of interfaceKeys("TourConfig")) expect([...topKeys, ...codeOnly()], key).toContain(key);
  });

  it("every code-only key is a real StepConfig or TourConfig key", () => {
    const real = [...interfaceKeys("StepConfig"), ...interfaceKeys("TourConfig")];
    for (const key of codeOnly()) expect(real, key).toContain(key);
  });

  it("every button and dim key of the public types is in the schema", () => {
    const keysOf = (name: string) => interfaceKeys(name);
    const dim = Object.keys((defs["dim"] as unknown as { properties: object }).properties);
    const button = Object.keys(defs["button"]!.properties);
    const position = Object.keys(defs["position"]!.properties);
    const spotlight = Object.keys(defs["spotlight"]!.properties);
    expect(dim.sort()).toEqual(keysOf("DimConfig").sort());
    expect(button.sort()).toEqual(keysOf("ButtonConfig").sort());
    expect(position.sort()).toEqual(keysOf("PositionOptions").sort());
    expect(spotlight.sort()).toEqual(keysOf("SpotlightOptions").sort());
  });
});
