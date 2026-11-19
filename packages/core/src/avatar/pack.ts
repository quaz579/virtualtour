/** Where an avatar pack failed validation, as a dotted path such as `animations.wave.frames[2].ms`. */
export class AvatarPackError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "AvatarPackError";
    this.path = path;
  }
}

/** Sprite sheet description. Sizes are CSS pixels. */
export interface SheetInfo {
  src: string;
  frameWidth: number;
  frameHeight: number;
  columns?: number;
  scale?: number;
  pixelArt?: boolean;
}

/** One frame. Give either `col`/`row` (grid indices) or `x`/`y` (image pixels), not both. */
export interface FrameDef {
  col?: number;
  row?: number;
  x?: number;
  y?: number;
  ms: number;
}

/** A named animation. `still` is the frame index shown under reduced motion and after a non-loop run. */
export interface AnimationDef {
  frames: FrameDef[];
  loop?: boolean;
  still?: number;
}

export type AvatarDirection = "left" | "right" | "up" | "down";

export type AvatarRole = "rest" | "idle" | "greet" | "point" | "think" | "celebrate" | "exit" | "alert";

export interface PointRoles {
  left?: string;
  right?: string;
  up?: string;
  down?: string;
  any?: string;
}

/** Maps roles to animation names. Missing roles resolve to `rest`. */
export interface RoleMap {
  rest: string;
  idle?: string | string[];
  greet?: string;
  point?: PointRoles;
  think?: string;
  celebrate?: string;
  exit?: string;
  alert?: string;
}

export interface BubbleHints {
  dock?: "start" | "end" | "auto";
  gap?: number;
}

export interface LicenseInfo {
  name?: string;
  url?: string;
  attribution?: string;
}

/** The `virtualtour-avatar/1` pack format. */
export interface AvatarPack {
  format: "virtualtour-avatar/1";
  name: string;
  version?: string;
  sheet: SheetInfo;
  animations: Record<string, AnimationDef>;
  roles: RoleMap;
  bubble?: BubbleHints;
  license?: LicenseInfo;
}

/** A pack with frame offsets in CSS pixels and an absolute sheet URL. */
export interface NormalizedPack extends AvatarPack {
  frames: Record<string, { x: number; y: number; ms: number }[]>;
  sheetUrl: string;
  stillOf(name: string): number;
}

const FORMAT = "virtualtour-avatar/1";
export const hasOwn = (target: object, key: string): boolean => Object.prototype.hasOwnProperty.call(target, key);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function fail(path: string, message: string): never {
  throw new AvatarPackError(path, message);
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) fail(path, "must be an object");
  return value;
}

function noExtraKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(join(path, key), "is not a known property");
  }
}

function text(value: unknown, path: string, nonEmpty = false): string {
  if (typeof value !== "string") fail(path, "must be a string");
  if (nonEmpty && value === "") fail(path, "must not be empty");
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "must be a finite number");
  return value;
}

function positive(value: unknown, path: string): number {
  if (finite(value, path) <= 0) fail(path, "must be greater than 0");
  return value as number;
}

function nonNegative(value: unknown, path: string, integer: boolean): number {
  const n = finite(value, path);
  if (n < 0) fail(path, "must be 0 or greater");
  if (integer && !Number.isInteger(n)) fail(path, "must be an integer");
  return n;
}

function validateSheet(value: unknown): SheetInfo {
  const sheet = object(value, "sheet");
  noExtraKeys(sheet, ["src", "frameWidth", "frameHeight", "columns", "scale", "pixelArt"], "sheet");
  const out: SheetInfo = {
    src: text(sheet.src, "sheet.src", true),
    frameWidth: positive(sheet.frameWidth, "sheet.frameWidth"),
    frameHeight: positive(sheet.frameHeight, "sheet.frameHeight"),
  };
  if (sheet.columns !== undefined) {
    const columns = finite(sheet.columns, "sheet.columns");
    if (!Number.isInteger(columns) || columns < 1) fail("sheet.columns", "must be an integer of 1 or more");
    out.columns = columns;
  }
  if (sheet.scale !== undefined) out.scale = positive(sheet.scale, "sheet.scale");
  if (sheet.pixelArt !== undefined) {
    if (typeof sheet.pixelArt !== "boolean") fail("sheet.pixelArt", "must be a boolean");
    out.pixelArt = sheet.pixelArt;
  }
  return out;
}

function validateFrame(value: unknown, path: string): FrameDef {
  const frame = object(value, path);
  const ms = positive(frame.ms, join(path, "ms"));
  const hasGrid = frame.col !== undefined || frame.row !== undefined;
  const hasPixels = frame.x !== undefined || frame.y !== undefined;
  if (hasGrid && hasPixels) fail(path, "use either col/row or x/y, not both");
  if (hasGrid) {
    if (frame.col === undefined) fail(join(path, "col"), "is required with row");
    if (frame.row === undefined) fail(join(path, "row"), "is required with col");
    return { col: nonNegative(frame.col, join(path, "col"), true), row: nonNegative(frame.row, join(path, "row"), true), ms };
  }
  if (hasPixels) {
    if (frame.x === undefined) fail(join(path, "x"), "is required with y");
    if (frame.y === undefined) fail(join(path, "y"), "is required with x");
    return { x: nonNegative(frame.x, join(path, "x"), false), y: nonNegative(frame.y, join(path, "y"), false), ms };
  }
  return fail(path, "needs col/row or x/y");
}

function validateAnimation(value: unknown, path: string): AnimationDef {
  const animation = object(value, path);
  noExtraKeys(animation, ["frames", "loop", "still"], path);
  const rawFrames = animation.frames;
  if (!Array.isArray(rawFrames) || rawFrames.length === 0) fail(join(path, "frames"), "must be a non-empty array");
  const out: AnimationDef = { frames: rawFrames.map((frame, i) => validateFrame(frame, `${path}.frames[${i}]`)) };
  if (animation.loop !== undefined) {
    if (typeof animation.loop !== "boolean") fail(join(path, "loop"), "must be a boolean");
    out.loop = animation.loop;
  }
  if (animation.still !== undefined) {
    const still = nonNegative(animation.still, join(path, "still"), true);
    if (still >= out.frames.length) fail(join(path, "still"), `must be less than the frame count (${out.frames.length})`);
    out.still = still;
  }
  return out;
}

function validateRoles(value: unknown, animations: Record<string, AnimationDef>): RoleMap {
  const roles = object(value, "roles");
  noExtraKeys(roles, ["rest", "idle", "greet", "point", "think", "celebrate", "exit", "alert"], "roles");
  const exists = (name: unknown, path: string): string => {
    const animation = text(name, path);
    if (!hasOwn(animations, animation)) fail(path, `names an animation that does not exist ("${animation}")`);
    return animation;
  };
  if (roles.rest === undefined) fail("roles.rest", "is required");
  const out: RoleMap = { rest: exists(roles.rest, "roles.rest") };
  if (roles.idle !== undefined) {
    if (Array.isArray(roles.idle) && roles.idle.length === 0) fail("roles.idle", "must not be an empty array");
    out.idle = Array.isArray(roles.idle)
      ? roles.idle.map((name, i) => exists(name, `roles.idle[${i}]`))
      : exists(roles.idle, "roles.idle");
  }
  for (const key of ["greet", "think", "celebrate", "exit", "alert"] as const) {
    if (roles[key] !== undefined) out[key] = exists(roles[key], `roles.${key}`);
  }
  if (roles.point !== undefined) {
    const point = object(roles.point, "roles.point");
    noExtraKeys(point, ["left", "right", "up", "down", "any"], "roles.point");
    const outPoint: PointRoles = {};
    for (const key of ["left", "right", "up", "down", "any"] as const) {
      if (point[key] !== undefined) outPoint[key] = exists(point[key], `roles.point.${key}`);
    }
    out.point = outPoint;
  }
  return out;
}

function validateBubble(value: unknown): BubbleHints {
  const bubble = object(value, "bubble");
  const out: BubbleHints = {};
  if (bubble.dock !== undefined) {
    if (bubble.dock !== "start" && bubble.dock !== "end" && bubble.dock !== "auto") {
      fail("bubble.dock", 'must be "start", "end" or "auto"');
    }
    out.dock = bubble.dock;
  }
  if (bubble.gap !== undefined) out.gap = finite(bubble.gap, "bubble.gap");
  return out;
}

function validateLicense(value: unknown): LicenseInfo {
  const license = object(value, "license");
  const out: LicenseInfo = {};
  for (const key of ["name", "url", "attribution"] as const) {
    if (license[key] !== undefined) out[key] = text(license[key], `license.${key}`);
  }
  return out;
}

/**
 * Checks parsed JSON against the `virtualtour-avatar/1` pack format and returns it typed.
 * @throws {AvatarPackError} with the path of the first invalid field.
 */
export function validatePack(json: unknown): AvatarPack {
  const root = object(json, "$");
  noExtraKeys(root, ["format", "name", "version", "sheet", "animations", "roles", "bubble", "license"], "");
  if (root.format !== FORMAT) fail("format", `must be "${FORMAT}"`);
  const name = text(root.name, "name", true);
  const sheet = validateSheet(root.sheet);
  const rawAnimations = object(root.animations, "animations");
  const names = Object.keys(rawAnimations);
  if (names.length === 0) fail("animations", "must define at least one animation");
  const animations: Record<string, AnimationDef> = {};
  for (const key of names) {
    Object.defineProperty(animations, key, {
      value: validateAnimation(rawAnimations[key], `animations.${key}`),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  const roles = validateRoles(root.roles, animations);
  const pack: AvatarPack = { format: FORMAT, name, sheet, animations, roles };
  if (root.version !== undefined) pack.version = text(root.version, "version");
  if (root.bubble !== undefined) pack.bubble = validateBubble(root.bubble);
  if (root.license !== undefined) pack.license = validateLicense(root.license);
  return pack;
}

function resolveSheetUrl(src: string, baseUrl: string): string {
  try {
    const base = /^[a-z][a-z0-9+.-]*:/i.test(baseUrl) || typeof location === "undefined" ? baseUrl : new URL(baseUrl, location.href).href;
    return new URL(src, base).href;
  } catch {
    return fail("sheet.src", `cannot be resolved against "${baseUrl}"`);
  }
}

/**
 * Turns frame definitions into CSS pixel offsets and resolves the sheet URL against `baseUrl`.
 * `col`/`row` multiply the frame size; `x`/`y` are image pixels and are divided by `sheet.scale`.
 * @throws {AvatarPackError} when `sheet.src` cannot be resolved.
 */
export function normalizePack(pack: AvatarPack, baseUrl: string): NormalizedPack {
  const { frameWidth, frameHeight, scale = 1 } = pack.sheet;
  const frames: NormalizedPack["frames"] = Object.create(null) as NormalizedPack["frames"];
  for (const [name, animation] of Object.entries(pack.animations)) {
    Object.defineProperty(frames, name, {
      value: animation.frames.map((frame) => ({
        x: frame.col !== undefined ? frame.col * frameWidth : (frame.x ?? 0) / scale,
        y: frame.row !== undefined ? frame.row * frameHeight : (frame.y ?? 0) / scale,
        ms: frame.ms,
      })),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  const stillOf = (name: string): number => {
    const animation = hasOwn(pack.animations, name) ? pack.animations[name] : undefined;
    if (!animation) return fail(`animations.${name}`, "is not defined in this pack");
    return animation.still ?? (animation.loop ? 0 : animation.frames.length - 1);
  };
  return { ...pack, frames, sheetUrl: resolveSheetUrl(pack.sheet.src, baseUrl), stillOf };
}

/** Options for {@link preloadSheet}. */
export interface PreloadSheetOptions {
  /** Rejects with an {@link AvatarPackError} and releases the image request when the signal aborts. */
  signal?: AbortSignal;
  /** Rejects with an {@link AvatarPackError} and releases the image request after this many milliseconds. No limit when omitted. */
  timeoutMs?: number;
}

/**
 * Loads and decodes the sheet image so the first frame paints without a flash, and resolves with its natural size.
 * Rejects with an {@link AvatarPackError} when the image fails to load, the signal aborts or `timeoutMs` passes; a
 * decode failure after a successful load still resolves because the browser will decode on paint.
 */
export function loadSheetImage(url: string, options: PreloadSheetOptions = {}): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (settle: () => void): void => {
      if (timer !== null) clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      image.onload = null;
      image.onerror = null;
      settle();
    };
    const release = (): void => {
      image.src = "";
    };
    const fail = (message: string): void =>
      finish(() => {
        release();
        reject(new AvatarPackError("sheet.src", message));
      });
    const onAbort = (): void => fail(`loading ${url} was cancelled`);
    if (options.signal?.aborted) {
      reject(new AvatarPackError("sheet.src", `loading ${url} was cancelled`));
      return;
    }
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const timeoutMs = options.timeoutMs;
    if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs >= 0) {
      timer = setTimeout(() => fail(`${url} did not load within ${timeoutMs} ms`), timeoutMs);
    }
    image.onload = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      if (typeof image.decode === "function") image.decode().then(() => finish(() => resolve(size)), () => finish(() => resolve(size)));
      else finish(() => resolve(size));
    };
    image.onerror = () => fail(`could not load ${url}`);
    image.src = url;
  });
}

/** Loads and decodes the sheet image; see {@link loadSheetImage}. */
export function preloadSheet(url: string, options: PreloadSheetOptions = {}): Promise<void> {
  return loadSheetImage(url, options).then(() => undefined);
}

function candidates(names: string | string[] | undefined, pack: NormalizedPack): string[] {
  const list = names === undefined ? [] : typeof names === "string" ? [names] : names;
  return list.filter((name) => hasOwn(pack.animations, name));
}

/**
 * Picks the animation name for a role. `point` falls back `point.<dir>`, `point.any`, `greet`, `rest`;
 * `idle` picks at random excluding `avoid` when another choice exists; other missing roles resolve to `rest`.
 * Pass `random` to make the idle pick deterministic.
 */
export function resolveRole(
  pack: NormalizedPack,
  role: AvatarRole,
  dir?: AvatarDirection,
  avoid?: string,
  random: () => number = Math.random,
): string {
  const { roles } = pack;
  if (role === "idle") {
    const all = candidates(roles.idle, pack);
    const pool = all.filter((name) => name !== avoid);
    const choices = pool.length > 0 ? pool : all;
    const picked = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    return picked ?? roles.rest;
  }
  if (role === "point") {
    const point = roles.point;
    const directional = dir !== undefined && point !== undefined && hasOwn(point, dir) ? point[dir] : undefined;
    return directional ?? point?.any ?? roles.greet ?? roles.rest;
  }
  return (hasOwn(roles, role) ? roles[role] : undefined) ?? roles.rest;
}
