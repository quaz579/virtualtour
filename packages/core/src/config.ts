import type { Config } from "./engine/types";
import type { CornerRadius, DimConfig, PresenterFactory, ProgressConfig, StepConfig, StepConfigPatch, TourConfig } from "./types";

const NAMESPACE_PATTERN = /^[a-zA-Z][\w-]*$/;

/** Dim options with every default applied. */
export interface NormalizedDim {
  padding: number;
  radius: number | Required<CornerRadius>;
  transitionMs: number;
  color: string;
  opacity: number;
  clickOutside: "none" | "exit" | "forward";
  pageScroll: boolean;
  lockScrollParent: boolean;
  clipToScrollParents: boolean;
}

/** A {@link TourConfig} with every default applied and every nested group in its full form. */
export interface NormalizedTourConfig {
  id: string;
  name?: string;
  steps: StepConfig[];
  /** Built-in step defaults with the caller's `stepDefaults` merged over them. */
  stepDefaults: StepConfig;
  /** Whether the overlay is drawn. */
  dim: boolean;
  /** Dim options; also used for spotlight fallbacks when `dim` is `false`. */
  dimOptions: NormalizedDim;
  mountIn?: Element | (() => Element);
  dimMountIn?: Element | (() => Element);
  namespace: string;
  keys: { escape: boolean; arrows: boolean };
  exitPrompt: false | string | (() => boolean | Promise<boolean>);
  counter: boolean | ((index: number, total: number) => string);
  labels: { next: string; back: string; done: string; close: string };
  progress?: ProgressConfig;
  presenter?: PresenterFactory;
  sanitize?: (html: string) => string;
  animate: boolean;
  waitBudget: number;
}

export type EngineNamespace = NonNullable<Config["namespace"]>;

export const DEFAULT_NAMESPACE = "vt";

export const DEFAULT_WAIT_BUDGET_MS = 10000;

export const DEFAULT_HOOK_TIMEOUT_MS = 10000;

export const DEFAULT_KEYS = Object.freeze({ escape: true, arrows: true });

export const DEFAULT_LABELS = Object.freeze({ next: "Next", back: "Back", done: "Done", close: "Close" });

export const DEFAULT_DIM: Readonly<NormalizedDim> = Object.freeze({
  padding: 10,
  radius: 5,
  transitionMs: 400,
  color: "#000",
  opacity: 0.7,
  clickOutside: "none",
  pageScroll: true,
  lockScrollParent: false,
  clipToScrollParents: true,
});

export const DEFAULT_POSITION = Object.freeze({
  offset: Object.freeze({ main: 10, cross: 0 }),
  viewportPadding: 0,
  boundary: "scrollParents" as const,
  flip: true,
  shift: true,
  strategy: "fixed" as const,
  arrow: Object.freeze({ minInset: 15 }),
});

export const DEFAULT_STEP_CONFIG: Readonly<StepConfig> = Object.freeze({
  whenMissing: "center",
  closeButton: true,
  focus: "dialog",
  reveal: true,
  position: DEFAULT_POSITION,
  spotlight: { extra: [], targetInteractive: true },
} satisfies StepConfig);

const MERGED_STEP_KEYS: ReadonlySet<string> = new Set(["position", "spotlight", "closeButton", "extensions"]);

const UNSAFE_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice();
  if (isPlainObject(value)) return mergeObjects({}, value);
  return value;
}

function mergeObjects(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    if (UNSAFE_KEYS.has(key)) continue;
    out[key] = cloneValue(base[key]);
  }
  for (const key of Object.keys(patch)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const next = patch[key];
    if (next === undefined) continue;
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(next) ? mergeObjects(current, next) : cloneValue(next);
  }
  return out;
}

/**
 * Merges a step patch over a base. Plain objects under `position`, `spotlight`, `closeButton` and
 * `extensions` merge recursively; arrays, functions, elements and every other key are replaced.
 * `undefined` in the patch keeps the base value. Neither input is modified or shared with the result.
 */
export function mergeStepConfig(base: Partial<StepConfig>, patch: Partial<StepConfig>): StepConfig {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !UNSAFE_KEYS.has(key)) out[key] = cloneValue(value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || UNSAFE_KEYS.has(key)) continue;
    const current = out[key];
    out[key] =
      MERGED_STEP_KEYS.has(key) && isPlainObject(current) && isPlainObject(value)
        ? mergeObjects(current, value)
        : cloneValue(value);
  }
  return out as StepConfig;
}

function ownValue(source: Record<string, unknown> | undefined, key: string): unknown {
  return source && Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
}

function plainOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return isPlainObject(value) ? value : undefined;
}

function applyClearingPatch(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  defaults: Record<string, unknown> | undefined,
  nested: (key: string) => boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !UNSAFE_KEYS.has(key)) out[key] = cloneValue(value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || UNSAFE_KEYS.has(key)) continue;
    if (value === null) {
      const fallback = ownValue(defaults, key);
      if (fallback === undefined) delete out[key];
      else out[key] = cloneValue(fallback);
      continue;
    }
    const current = out[key];
    out[key] =
      nested(key) && isPlainObject(value)
        ? applyClearingPatch(isPlainObject(current) ? current : {}, value, plainOrUndefined(ownValue(defaults, key)), () => true)
        : cloneValue(value);
  }
  return out;
}

export function patchStepConfig(
  base: Partial<StepConfig>,
  patch: StepConfigPatch,
  defaults: Partial<StepConfig>
): StepConfig {
  const rest = Object.fromEntries(Object.entries(patch).filter(([key]) => key !== "id"));
  return applyClearingPatch(
    base as Record<string, unknown>,
    rest,
    defaults as Record<string, unknown>,
    (key) => MERGED_STEP_KEYS.has(key)
  ) as StepConfig;
}

/** Merges the tour's step defaults under a step definition. */
export function resolveStepConfig(config: NormalizedTourConfig, def: StepConfig): StepConfig {
  return mergeStepConfig(config.stepDefaults, def);
}

let idCounter = 0;

function randomChunk(length: number): string {
  let out = "";
  while (out.length < length) out += Math.random().toString(36).slice(2);
  return out.slice(0, length);
}

/** Builds a tour id of the form `<name-slug>-<random>`; the slug is `tour` when the name is empty. */
export function makeTourId(name?: string): string {
  const slug = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  idCounter += 1;
  return `${slug || "tour"}-${randomChunk(6)}${idCounter.toString(36)}`;
}

/** Throws when `namespace` is not a valid class and attribute prefix. */
export function assertValidNamespace(namespace: unknown): asserts namespace is string {
  if (typeof namespace !== "string" || !NAMESPACE_PATTERN.test(namespace)) {
    throw new TypeError(
      `[virtualtour] Invalid namespace "${String(namespace)}": use letters, digits, "_" or "-", starting with a letter.`
    );
  }
}

function expandRadius(radius: number | CornerRadius): number | Required<CornerRadius> {
  if (typeof radius === "number") return radius;
  const base = DEFAULT_DIM.radius as number;
  return {
    topLeft: radius.topLeft ?? base,
    topRight: radius.topRight ?? base,
    bottomRight: radius.bottomRight ?? base,
    bottomLeft: radius.bottomLeft ?? base,
  };
}

function normalizeDim(dim: TourConfig["dim"]): { dim: boolean; dimOptions: NormalizedDim } {
  const patch: DimConfig = typeof dim === "object" && dim !== null ? dim : {};
  const merged = mergeObjects(DEFAULT_DIM as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  const dimOptions = merged as unknown as NormalizedDim;
  dimOptions.radius = expandRadius(dimOptions.radius);
  return { dim: dim === true || (typeof dim === "object" && dim !== null), dimOptions };
}

/** Applies every default to a {@link TourConfig}; throws when `namespace` is invalid. */
export function normalizeTourConfig(config: TourConfig): NormalizedTourConfig {
  const namespace = config.namespace ?? DEFAULT_NAMESPACE;
  assertValidNamespace(namespace);

  const { dim, dimOptions } = normalizeDim(config.dim);
  const out: NormalizedTourConfig = {
    id: config.id ?? makeTourId(config.name),
    steps: (config.steps ?? []).slice(),
    stepDefaults: mergeStepConfig(DEFAULT_STEP_CONFIG, config.stepDefaults ?? {}),
    dim,
    dimOptions,
    namespace,
    keys: mergeObjects(DEFAULT_KEYS, config.keys ?? {}) as NormalizedTourConfig["keys"],
    exitPrompt: config.exitPrompt ?? false,
    counter: config.counter ?? false,
    labels: mergeObjects(DEFAULT_LABELS, config.labels ?? {}) as NormalizedTourConfig["labels"],
    animate: config.animate ?? true,
    waitBudget: config.waitBudget ?? DEFAULT_WAIT_BUDGET_MS,
  };
  if (config.name !== undefined) out.name = config.name;
  if (config.mountIn !== undefined) out.mountIn = config.mountIn;
  if (config.dimMountIn !== undefined) out.dimMountIn = config.dimMountIn;
  if (config.progress !== undefined) out.progress = config.progress;
  if (config.presenter !== undefined) out.presenter = config.presenter;
  if (config.sanitize !== undefined) out.sanitize = config.sanitize;
  return out;
}
