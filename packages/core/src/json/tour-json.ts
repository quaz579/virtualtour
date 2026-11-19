import { TourEnvironmentError } from "../errors";
import type { JsonValue, TourConfig } from "../types";

/** A function a JSON tour may reference by name. */
export type TourJsonHandler = (...args: never[]) => unknown;

/** `{ "handler": name }`: the only place a function appears in a JSON tour. */
export interface HandlerRefJson {
  handler: string;
}

/** A string, or a handler returning one. */
export type TextJson = string | HandlerRefJson;

/** Per-corner radius in JSON. */
export interface CornerRadiusJson {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
}

/** Dim options in JSON. */
export interface DimJsonV1 {
  padding?: number;
  radius?: number | CornerRadiusJson;
  transitionMs?: number;
  color?: string;
  opacity?: number;
  clickOutside?: "none" | "exit" | "forward";
  pageScroll?: boolean;
  lockScrollParent?: boolean;
  clipToScrollParents?: boolean;
}

/** A footer button in JSON. */
export interface ButtonJsonV1 {
  text: TextJson;
  label?: TextJson;
  action: "forward" | "backward" | "exit" | "finish" | HandlerRefJson;
  disabled?: boolean | HandlerRefJson;
  kind?: "primary" | "secondary";
  classes?: string | string[];
  attrs?: Record<string, string>;
}

/** One step in JSON. */
export interface StepJsonV1 {
  id?: string;
  title?: TextJson;
  body?: string | string[];
  label?: TextJson;
  closeButton?: boolean | { label?: TextJson; attrs?: Record<string, string> };
  classes?: string | string[];
  meta?: JsonValue;
  buttons?: ButtonJsonV1[];
  target?: string | HandlerRefJson;
  placement?: "auto" | { side: "top" | "bottom" | "left" | "right" | "auto" | "over"; align?: "start" | "center" | "end" };
  position?: {
    offset?: number | { main?: number; cross?: number };
    viewportPadding?: number;
    boundary?: "scrollParents" | "viewport";
    flip?: boolean;
    shift?: boolean;
    strategy?: "fixed" | "absolute";
    arrow?: boolean | { minInset?: number };
  };
  waitFor?: number;
  whenMissing?: "center" | "skip";
  shouldShow?: HandlerRefJson;
  prepare?: HandlerRefJson;
  hookTimeout?: number;
  spotlight?: {
    padding?: number;
    radius?: number | CornerRadiusJson;
    extra?: string[];
    class?: string;
    targetInteractive?: boolean | "hover-only";
  };
  reveal?: boolean | "smooth" | { behavior?: "auto" | "smooth" | "instant"; block?: "start" | "center" | "end" | "nearest"; inline?: "start" | "center" | "end" | "nearest" };
  revealWith?: HandlerRefJson;
  autoAdvance?: { event: string | string[]; selector?: string; strict?: boolean };
  instruction?: TextJson;
  advanceDelay?: number;
  focus?: "dialog" | "first-button";
  extensions?: Record<string, unknown>;
}

/** The `virtualtour-tour/1` document. */
export interface TourJsonV1 {
  $schema?: string;
  format: "virtualtour-tour/1";
  id?: string;
  name?: string;
  dim?: boolean | DimJsonV1;
  mountIn?: string;
  dimMountIn?: string;
  namespace?: string;
  keys?: { escape?: boolean; arrows?: boolean };
  exitPrompt?: false | string | HandlerRefJson;
  counter?: boolean | HandlerRefJson;
  labels?: { next?: string; back?: string; done?: string; close?: string };
  animate?: boolean;
  waitBudget?: number;
  stepDefaults?: Omit<StepJsonV1, "id">;
  steps: StepJsonV1[];
}

/** Options of {@link parseTourJson}. */
export interface ParseTourJsonOptions {
  /** Functions a document may name with `{ "handler": name }`. */
  handlers?: Readonly<Record<string, TourJsonHandler>>;
}

/** Options of {@link serializeTour}. */
export interface SerializeTourOptions {
  /** Name to write for every function in the config. */
  handlerNames?: ReadonlyMap<TourJsonHandler, string>;
  /** Selector to write for every element in the config. */
  elementSelectors?: ReadonlyMap<Element, string>;
}

/** Thrown for a document or config that is not a valid JSON tour; `path` locates the offender, for example `steps[2].buttons[0].action.handler`. */
export class TourJsonError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path || "$"}: ${message}`);
    this.name = "TourJsonError";
    this.path = path;
  }
}

type D =
  | { t: "str"; re?: RegExp }
  | { t: "num"; min?: number | undefined; max?: number | undefined }
  | { t: "bool" }
  | { t: "enum"; v: readonly string[] }
  | { t: "const"; v: string | boolean }
  | { t: "any" }
  | { t: "arr"; of: D }
  | { t: "rec"; of: D }
  | { t: "obj"; p: Record<string, D>; req?: readonly string[] | undefined }
  | { t: "fn" }
  | { t: "sel"; mount?: boolean }
  | { t: "one"; of: readonly D[] };

interface Ctx {
  parse: boolean;
  handlers: Readonly<Record<string, TourJsonHandler>>;
  names: ReadonlyMap<TourJsonHandler, string>;
  selectors: ReadonlyMap<Element, string>;
}

const str: D = { t: "str" };
const bool: D = { t: "bool" };
const fn: D = { t: "fn" };
const num = (min?: number, max?: number): D => ({ t: "num", min, max });
const en = (...v: string[]): D => ({ t: "enum", v });
const obj = (p: Record<string, D>, req?: readonly string[]): D => ({ t: "obj", p, req });
const one = (...of: D[]): D => ({ t: "one", of });
const strings: D = { t: "arr", of: str };
const attrs: D = { t: "rec", of: str };
const text = one(str, fn);
const radius = (): D => {
  const c = num(0);
  return one(c, obj({ topLeft: c, topRight: c, bottomRight: c, bottomLeft: c }));
};
const scrollEdge = en("start", "center", "end", "nearest");

const stepProps: Record<string, D> = {
  id: str,
  title: text,
  body: one(str, strings),
  label: text,
  closeButton: one(bool, obj({ label: text, attrs })),
  classes: one(str, strings),
  meta: { t: "any" },
  buttons: {
    t: "arr",
    of: obj(
      {
        text,
        label: text,
        action: one(en("forward", "backward", "exit", "finish"), fn),
        disabled: one(bool, fn),
        kind: en("primary", "secondary"),
        classes: one(str, strings),
        attrs,
      },
      ["text", "action"],
    ),
  },
  target: one({ t: "sel" }, fn),
  placement: one(
    { t: "const", v: "auto" },
    obj({ side: { t: "enum", v: ["top", "bottom", "left", "right", "auto", "over"] }, align: en("start", "center", "end") }, ["side"]),
  ),
  position: obj({
    offset: one(num(), obj({ main: num(), cross: num() })),
    viewportPadding: num(0),
    boundary: en("scrollParents", "viewport"),
    flip: bool,
    shift: bool,
    strategy: en("fixed", "absolute"),
    arrow: one(bool, obj({ minInset: num(0) })),
  }),
  waitFor: num(0),
  whenMissing: en("center", "skip"),
  shouldShow: fn,
  prepare: fn,
  hookTimeout: num(0),
  spotlight: obj({
    padding: num(0),
    radius: radius(),
    extra: strings,
    class: str,
    targetInteractive: one(bool, { t: "const", v: "hover-only" }),
  }),
  reveal: one(bool, { t: "const", v: "smooth" }, obj({ behavior: en("auto", "smooth", "instant"), block: scrollEdge, inline: scrollEdge })),
  revealWith: fn,
  autoAdvance: obj({ event: one(str, strings), selector: str, strict: bool }, ["event"]),
  instruction: text,
  advanceDelay: num(0),
  focus: en("dialog", "first-button"),
  extensions: { t: "rec", of: { t: "any" } },
};

const { id: _stepId, ...defaultsProps } = stepProps;

const rootSpec = obj(
  {
    $schema: str,
    format: { t: "const", v: "virtualtour-tour/1" },
    id: str,
    name: str,
    dim: one(
      bool,
      obj({
        padding: num(0),
        radius: radius(),
        transitionMs: num(0),
        color: str,
        opacity: num(0, 1),
        clickOutside: en("none", "exit", "forward"),
        pageScroll: bool,
        lockScrollParent: bool,
        clipToScrollParents: bool,
      }),
    ),
    mountIn: { t: "sel", mount: true },
    dimMountIn: { t: "sel", mount: true },
    namespace: { t: "str", re: /^[a-zA-Z][a-zA-Z0-9_-]*$/ },
    keys: obj({ escape: bool, arrows: bool }),
    exitPrompt: one({ t: "const", v: false }, str, fn),
    counter: one(bool, fn),
    labels: obj({ next: str, back: str, done: str, close: str }),
    animate: bool,
    waitBudget: num(0),
    stepDefaults: obj(defaultsProps),
    steps: { t: "arr", of: obj(stepProps) },
  },
  ["format", "steps"],
);

const selectorThunks = new WeakMap<object, string>();

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const join = (p: string, k: string): string => (p ? `${p}.${k}` : k);
const isElement = (v: unknown): v is Element => typeof Element !== "undefined" && v instanceof Element;

function fail(path: string, message: string): never {
  throw new TourJsonError(path, message);
}

function kindOf(v: unknown, parse: boolean): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (!parse && typeof v === "function") return "function";
  if (!parse && isElement(v)) return "element";
  return typeof v;
}

function kindsOf(d: D, parse: boolean): string[] {
  switch (d.t) {
    case "str":
    case "enum":
      return ["string"];
    case "const":
      return [typeof d.v];
    case "num":
      return ["number"];
    case "bool":
      return ["boolean"];
    case "arr":
      return ["array"];
    case "fn":
      return [parse ? "object" : "function"];
    case "sel":
      return parse ? ["string"] : d.mount ? ["function", "element"] : ["string", "element"];
    default:
      return ["object"];
  }
}

function label(d: D): string {
  switch (d.t) {
    case "str":
      return "a string";
    case "num":
      return "a number";
    case "bool":
      return "a boolean";
    case "enum":
      return `one of ${d.v.map((x) => JSON.stringify(x)).join(", ")}`;
    case "const":
      return JSON.stringify(d.v);
    case "arr":
      return "an array";
    case "fn":
      return "a handler object";
    case "sel":
      return "a selector";
    default:
      return "an object";
  }
}

function mountThunk(selector: string, path: string): () => Element {
  const thunk = (): Element => {
    const found = document.querySelector(selector);
    if (!found) throw new TourEnvironmentError(`${path}: no element matches "${selector}"`);
    return found;
  };
  selectorThunks.set(thunk, selector);
  return thunk;
}

function walk(d: D, v: unknown, path: string, c: Ctx): unknown {
  switch (d.t) {
    case "any":
      return v;
    case "str":
      if (typeof v !== "string") fail(path, "expected a string");
      if (d.re && !d.re.test(v)) fail(path, `must match ${d.re.source}`);
      return v;
    case "num":
      if (typeof v !== "number" || !Number.isFinite(v)) fail(path, "expected a finite number");
      if (d.min !== undefined && v < d.min) fail(path, `must be at least ${d.min}`);
      if (d.max !== undefined && v > d.max) fail(path, `must be at most ${d.max}`);
      return v;
    case "bool":
      if (typeof v !== "boolean") fail(path, "expected a boolean");
      return v;
    case "enum":
      if (typeof v !== "string" || !d.v.includes(v)) fail(path, `expected ${label(d)}`);
      return v;
    case "const":
      if (v !== d.v) fail(path, `expected ${label(d)}`);
      return v;
    case "arr": {
      if (!Array.isArray(v)) fail(path, "expected an array");
      return v.map((item, i) => walk(d.of, item, `${path}[${i}]`, c));
    }
    case "rec": {
      if (!isObj(v)) fail(path, "expected an object");
      for (const k of Object.keys(v)) walk(d.of, v[k], join(path, k), c);
      return v;
    }
    case "obj": {
      if (!isObj(v)) fail(path, "expected an object");
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v)) {
        if (!has(d.p, k)) fail(join(path, k), c.parse ? "unknown key" : "cannot be written as JSON");
        if (v[k] !== undefined) out[k] = walk(d.p[k]!, v[k], join(path, k), c);
      }
      for (const k of d.req ?? []) if (!has(out, k)) fail(join(path, k), "is required");
      return out;
    }
    case "fn": {
      if (c.parse) {
        if (!isObj(v)) fail(path, "expected a handler object");
        for (const k of Object.keys(v)) if (k !== "handler") fail(join(path, k), "unknown key");
        if (!has(v, "handler")) fail(join(path, "handler"), "is required");
        const name = v["handler"];
        if (typeof name !== "string") fail(join(path, "handler"), "expected a string");
        if (!has(c.handlers, name)) fail(join(path, "handler"), `no handler named "${name}"`);
        return c.handlers[name];
      }
      if (typeof v !== "function") fail(path, "expected a function");
      const name = c.names.get(v as TourJsonHandler);
      if (name === undefined) fail(path, "function has no registered handler name");
      return { handler: name };
    }
    case "sel": {
      if (c.parse) {
        if (typeof v !== "string") fail(path, "expected a selector string");
        return d.mount ? mountThunk(v, path) : v;
      }
      if (typeof v === "string" && !d.mount) return v;
      if (typeof v === "function") {
        const selector = selectorThunks.get(v);
        if (selector === undefined) fail(path, "function cannot be written as a selector");
        return selector;
      }
      if (isElement(v)) {
        const selector = c.selectors.get(v);
        if (selector === undefined) fail(path, "element has no registered selector");
        return selector;
      }
      return fail(path, "expected a selector");
    }
    case "one": {
      const kind = kindOf(v, c.parse);
      const alt = d.of.find((a) => kindsOf(a, c.parse).includes(kind));
      if (!alt) fail(path, `expected ${d.of.map(label).join(" or ")}`);
      return walk(alt, v, path, c);
    }
  }
}

/**
 * Turns a `virtualtour-tour/1` document, as text or an already parsed value, into a {@link TourConfig}. Handler
 * references resolve through `options.handlers`; `mountIn` and `dimMountIn` selectors become functions that look the
 * element up when called and throw {@link TourEnvironmentError} naming the path when nothing matches.
 * @throws {TourJsonError} for any invalid, unknown or unresolvable member, with its JSON path.
 */
export function parseTourJson(json: unknown, options: ParseTourJsonOptions = {}): TourConfig {
  let value = json;
  if (typeof json === "string") {
    try {
      value = JSON.parse(json);
    } catch (error) {
      fail("", `invalid JSON: ${(error as Error).message}`);
    }
  }
  const ctx: Ctx = { parse: true, handlers: options.handlers ?? {}, names: new Map(), selectors: new Map() };
  const { $schema: _ignored, format: _format, ...config } = walk(rootSpec, value, "", ctx) as Record<string, unknown>;
  return config as TourConfig;
}

/**
 * Writes a {@link TourConfig} as a `virtualtour-tour/1` document. Every function needs an entry in
 * `options.handlerNames` and every element one in `options.elementSelectors`; functions made by
 * {@link parseTourJson} for `mountIn` and `dimMountIn` write back their selector.
 * @throws {TourJsonError} when a function or element has no name, or the config holds something JSON cannot carry
 * (`progress`, `presenter`, `sanitize`, element or function bodies).
 */
export function serializeTour(config: TourConfig, options: SerializeTourOptions = {}): TourJsonV1 {
  const ctx: Ctx = {
    parse: false,
    handlers: {},
    names: options.handlerNames ?? new Map(),
    selectors: options.elementSelectors ?? new Map(),
  };
  const out = walk(rootSpec, { format: "virtualtour-tour/1", ...config, steps: config.steps ?? [] }, "", ctx);
  return out as TourJsonV1;
}
