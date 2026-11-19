import { AvatarPackError } from "./pack";
import type { AvatarPack, LicenseInfo, PointRoles, RoleMap } from "./pack";

/** Where a classic map and its sheet live, plus overrides for what the map cannot say. */
export interface ClassicSource {
  sheetUrl: string;
  mapUrl: string;
  name?: string;
  /** Required for the column/row format when the sheet size cannot be measured; the pixel format carries its own. */
  frameSize?: { w: number; h: number };
  /** Replaces individual default role mappings. */
  roles?: Partial<RoleMap>;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

/** Options for the pure converters. */
export interface ClassicConvertOptions {
  sheetUrl: string;
  name?: string;
  frameSize?: { w: number; h: number };
  roles?: Partial<RoleMap>;
}

export type ClassicFormat = "column-row" | "position";

export const CLASSIC_LICENSE: LicenseInfo = { name: "unknown", attribution: "Supplied by the integrator" };

const DEFAULT_NAME = "Classic avatar pack";

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new AvatarPackError(path, message);
}

function setOwn<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

/**
 * Recognizes a classic map by shape: an array of `{ Name, Frames }` is the column/row format; an object with
 * `animations` and `frameWidth`/`frameHeight` or `framesize` is the pixel-position format.
 * @throws {AvatarPackError} for any other shape.
 */
export function detectClassicFormat(json: unknown): ClassicFormat {
  if (Array.isArray(json)) {
    if (json.length > 0 && json.every((item) => isRecord(item) && typeof item["Name"] === "string" && Array.isArray(item["Frames"]))) {
      return "column-row";
    }
    return fail("$", "an array map needs items shaped { Name, Frames }");
  }
  if (isRecord(json) && isRecord(json["animations"])) {
    const sized = (json["frameWidth"] !== undefined && json["frameHeight"] !== undefined) || json["framesize"] !== undefined;
    if (sized) return "position";
  }
  return fail("$", "is not a recognized classic map (expected a { Name, Frames } array or an object with animations and frameWidth/frameHeight or framesize)");
}

function columnRowOffset(frame: unknown, path: string): { col: number; row: number } | null {
  if (!isRecord(frame)) return fail(path, "must be an object");
  const offsets = frame["ImagesOffsets"];
  if (offsets === null || offsets === undefined) return null;
  if (!isRecord(offsets)) return fail(`${path}.ImagesOffsets`, "must be an object or null");
  const col = offsets["Column"];
  const row = offsets["Row"];
  if (typeof col !== "number" || !Number.isInteger(col) || col < 0) return fail(`${path}.ImagesOffsets.Column`, "must be an integer of 0 or more");
  if (typeof row !== "number" || !Number.isInteger(row) || row < 0) return fail(`${path}.ImagesOffsets.Row`, "must be an integer of 0 or more");
  return { col, row };
}

/**
 * Reads the largest column and row used by a column/row map. Divide the sheet size by `columns` and `rows`
 * to get the frame size.
 * @throws {AvatarPackError} when no frame carries an offset.
 */
export function classicGridSize(json: unknown): { columns: number; rows: number } {
  if (detectClassicFormat(json) !== "column-row") return fail("$", "is not a column/row map");
  let columns = 0;
  let rows = 0;
  (json as Json[]).forEach((animation, a) => {
    (animation["Frames"] as unknown[]).forEach((frame, f) => {
      const offset = columnRowOffset(frame, `[${a}].Frames[${f}]`);
      if (offset) {
        columns = Math.max(columns, offset.col + 1);
        rows = Math.max(rows, offset.row + 1);
      }
    });
  });
  if (columns === 0) return fail("$", "has no frame with ImagesOffsets, so the frame size cannot be derived");
  return { columns, rows };
}

function duration(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fail(path, "must be a finite number");
  return Math.max(1, value);
}

function nameOf(value: unknown, path: string): string {
  if (typeof value !== "string" || value === "") return fail(path, "must be a non-empty string");
  return value;
}

const first = (animations: Record<string, unknown>, names: readonly string[]): string | undefined =>
  names.find((name) => hasOwn(animations, name));

/**
 * The default role mapping for a classic pack, from well-known animation names. Roles whose candidates are
 * all missing are left out; `rest` falls back to the first animation.
 */
export function defaultClassicRoles(animations: Record<string, unknown>): RoleMap {
  const names = Object.keys(animations);
  const roles: RoleMap = { rest: first(animations, ["RestPose", "Default"]) ?? names[0] ?? "" };
  const idle = names.filter((name) => name.startsWith("Idle"));
  if (idle.length > 0) roles.idle = idle;
  const set = (role: "greet" | "think" | "celebrate" | "exit" | "alert", candidates: readonly string[]): void => {
    const found = first(animations, candidates);
    if (found !== undefined) roles[role] = found;
  };
  set("greet", ["Wave", "Greeting", "Show"]);
  set("think", ["Thinking", "Processing"]);
  set("celebrate", ["Congratulate"]);
  set("exit", ["GoodBye", "Hide"]);
  set("alert", ["Alert", "GetAttention"]);
  const point: PointRoles = {};
  const dirs: [keyof PointRoles, readonly string[]][] = [
    ["left", ["GestureLeft"]],
    ["right", ["GestureRight"]],
    ["up", ["GestureUp"]],
    ["down", ["GestureDown"]],
    ["any", ["Explain", "GetAttention"]],
  ];
  for (const [dir, candidates] of dirs) {
    const found = first(animations, candidates);
    if (found !== undefined) point[dir] = found;
  }
  if (Object.keys(point).length > 0) roles.point = point;
  return roles;
}

function assemble(
  animations: AvatarPack["animations"],
  sheet: AvatarPack["sheet"],
  options: ClassicConvertOptions,
): AvatarPack {
  if (Object.keys(animations).length === 0) fail("animations", "must define at least one animation");
  const overrides: Partial<RoleMap> = {};
  for (const [key, value] of Object.entries(options.roles ?? {})) {
    if (value !== undefined) (overrides as Record<string, unknown>)[key] = value;
  }
  return {
    format: "virtualtour-avatar/1",
    name: options.name ?? DEFAULT_NAME,
    sheet,
    animations,
    roles: { ...defaultClassicRoles(animations), ...overrides },
    license: { ...CLASSIC_LICENSE },
  };
}

/**
 * Converts the column/row format. Frames without `ImagesOffsets` are dropped and only `Duration` and
 * `ImagesOffsets` are read, so sound and branching fields are ignored.
 * @throws {AvatarPackError} when `options.frameSize` is missing, a name is duplicated, or an animation keeps no frame.
 */
export function fromClassicColumnRowMap(json: unknown, options: ClassicConvertOptions): AvatarPack {
  if (detectClassicFormat(json) !== "column-row") return fail("$", "is not a column/row map");
  const size = options.frameSize;
  if (!size) return fail("frameSize", "is required for the column/row format");
  const animations: AvatarPack["animations"] = {};
  let columns = 1;
  (json as Json[]).forEach((entry, a) => {
    const name = nameOf(entry["Name"], `[${a}].Name`);
    if (hasOwn(animations, name)) fail(`[${a}].Name`, `repeats the animation name "${name}"`);
    const frames: { col: number; row: number; ms: number }[] = [];
    (entry["Frames"] as unknown[]).forEach((frame, f) => {
      const path = `[${a}].Frames[${f}]`;
      const offset = columnRowOffset(frame, path);
      if (!offset) return;
      frames.push({ ...offset, ms: duration((frame as Json)["Duration"], `${path}.Duration`) });
      columns = Math.max(columns, offset.col + 1);
    });
    if (frames.length === 0) fail(`[${a}].Frames`, `has no frame with ImagesOffsets in "${name}"`);
    setOwn(animations, name, { frames });
  });
  return assemble(animations, { src: options.sheetUrl, frameWidth: size.w, frameHeight: size.h, columns }, options);
}

function framePosition(frame: Json, path: string): { x: number; y: number } | null {
  let position: unknown = frame["position"];
  if (position === undefined || position === null) {
    const images = frame["images"];
    if (Array.isArray(images)) position = images[0];
  }
  if (position === undefined || position === null) return null;
  if (!Array.isArray(position) || position.length < 2) return fail(path, "must be [x, y]");
  const [x, y] = position as unknown[];
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return fail(path, "must be [x, y] with finite numbers");
  }
  return { x, y };
}

function positionFrameSize(json: Json, override: ClassicConvertOptions["frameSize"]): { w: number; h: number } {
  if (override) return override;
  const pair = json["framesize"];
  if (json["frameWidth"] !== undefined && json["frameHeight"] !== undefined) {
    return { w: json["frameWidth"] as number, h: json["frameHeight"] as number };
  }
  if (Array.isArray(pair) && pair.length >= 2) return { w: pair[0] as number, h: pair[1] as number };
  return fail("framesize", "must be [width, height]");
}

/**
 * Converts the pixel-position format. Accepts `frameWidth`/`frameHeight` or `framesize: [w, h]`, and frame
 * positions as `position: [x, y]` or the first entry of `images`. Frames with no position are dropped;
 * `sound`, `branching`, `exitBranch` and `useExitBranching` are ignored.
 * @throws {AvatarPackError} for malformed frames or an animation that keeps no frame.
 */
export function fromClassicPositionMap(json: unknown, options: ClassicConvertOptions): AvatarPack {
  if (detectClassicFormat(json) !== "position") return fail("$", "is not a pixel-position map");
  const root = json as Json;
  const size = positionFrameSize(root, options.frameSize);
  const animations: AvatarPack["animations"] = {};
  for (const [name, raw] of Object.entries(root["animations"] as Json)) {
    if (!isRecord(raw) || !Array.isArray(raw["frames"])) {
      fail(`animations.${name}`, "must be an object with a frames array");
    }
    const entry = raw as Json;
    const frames: { x: number; y: number; ms: number }[] = [];
    (entry["frames"] as unknown[]).forEach((frame, f) => {
      const path = `animations.${name}.frames[${f}]`;
      if (!isRecord(frame)) return fail(path, "must be an object");
      const position = framePosition(frame, `${path}.position`);
      if (!position) return;
      frames.push({ ...position, ms: duration(frame["duration"], `${path}.duration`) });
    });
    if (frames.length === 0) fail(`animations.${name}.frames`, "has no frame with a position");
    const animation: AvatarPack["animations"][string] = { frames };
    if (typeof entry["loop"] === "boolean") animation.loop = entry["loop"];
    setOwn(animations, name, animation);
  }
  return assemble(animations, { src: options.sheetUrl, frameWidth: size.w, frameHeight: size.h }, options);
}
