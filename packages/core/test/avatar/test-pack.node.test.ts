import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { normalizePack, resolveRole, validatePack } from "../../src/avatar/pack";
import { buildTestPack, COLUMNS, FIXTURE_DIR, FRAME_SIZE, ROWS } from "../../tools/make-test-pack.mjs";

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../schemas/avatar-pack.v1.schema.json");
const packBaseUrl = "https://example.test/packs/synthetic/pack.json";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function decodePng(bytes: Buffer): { width: number; height: number; pixels: Buffer } {
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += 12 + length;
  }
  return { width, height, pixels: inflateSync(Buffer.concat(idat)) };
}

function pixelAt(png: { width: number; pixels: Buffer }, x: number, y: number): string {
  const stride = png.width * 3;
  const at = y * (stride + 1) + 1 + x * 3;
  return [...png.pixels.subarray(at, at + 3)].join(",");
}

const generated = buildTestPack();
const committed = (name: string): Buffer => readFileSync(join(FIXTURE_DIR, name));
const committedJson = (name: string): unknown => JSON.parse(committed(name).toString("utf8"));

const pack = validatePack(committedJson("pack.json"));

describe("synthetic test pack fixture", () => {
  it("is exactly what the generator writes", () => {
    expect(readdirSync(FIXTURE_DIR).sort()).toEqual([...generated.keys()].sort());
    for (const [name, bytes] of generated) {
      if (name.endsWith(".png")) {
        const fresh = decodePng(bytes);
        const onDisk = decodePng(committed(name));
        expect({ width: onDisk.width, height: onDisk.height, pixels: onDisk.pixels.toString("hex") }).toEqual({
          width: fresh.width,
          height: fresh.height,
          pixels: fresh.pixels.toString("hex"),
        });
      } else {
        expect(committed(name).toString("utf8")).toBe(bytes.toString("utf8"));
      }
    }
  });

  it("sheet.png is a PNG whose size is the grid size and whose 16 cells are distinct colors", () => {
    const png = decodePng(committed("sheet.png"));
    expect(png.width).toBe(COLUMNS * FRAME_SIZE);
    expect(png.height).toBe(ROWS * FRAME_SIZE);
    const colors = new Set<string>();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        colors.add(pixelAt(png, col * FRAME_SIZE + 1, row * FRAME_SIZE + 1));
      }
    }
    expect(colors.size).toBe(COLUMNS * ROWS);
  });

  it("pack.json passes validatePack and keeps the synthetic identity", () => {
    expect(pack.format).toBe("virtualtour-avatar/1");
    expect(pack.name).toBe("Synthetic test pack");
    expect(pack.sheet).toEqual({ src: "sheet.png", frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE, columns: COLUMNS, pixelArt: true });
  });

  it("pack.json passes avatar-pack.v1.schema.json, and the schema rejects a broken copy", () => {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
    const validate = new Ajv2020({ allErrors: true, strict: true, strictRequired: false }).compile(schema);
    const json = committedJson("pack.json");
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...(json as object), format: "virtualtour-avatar/2" })).toBe(false);
  });

  it("resolves every role to the animation it names", () => {
    const normalized = normalizePack(pack, packBaseUrl);
    const random = () => 0;
    expect(resolveRole(normalized, "rest")).toBe("rest");
    expect(resolveRole(normalized, "greet")).toBe("wave");
    expect(resolveRole(normalized, "think")).toBe("think");
    expect(resolveRole(normalized, "celebrate")).toBe("celebrate");
    expect(resolveRole(normalized, "exit")).toBe("exit");
    expect(resolveRole(normalized, "alert")).toBe("alert");
    expect(resolveRole(normalized, "point", "left")).toBe("point-left");
    expect(resolveRole(normalized, "point", "right")).toBe("point-right");
    expect(resolveRole(normalized, "point", "up")).toBe("point-up");
    expect(resolveRole(normalized, "point", "down")).toBe("point-down");
    expect(resolveRole(normalized, "point")).toBe("point-any");
    expect(resolveRole(normalized, "idle", undefined, undefined, random)).toBe("blink");
    expect(resolveRole(normalized, "idle", undefined, "blink", random)).toBe("wobble");
  });

  it("keeps every frame on the sheet and resolves the sheet URL", () => {
    const normalized = normalizePack(pack, packBaseUrl);
    const width = COLUMNS * FRAME_SIZE;
    const height = ROWS * FRAME_SIZE;
    for (const [name, frames] of Object.entries(normalized.frames)) {
      for (const frame of frames) {
        expect(frame.x, name).toBeGreaterThanOrEqual(0);
        expect(frame.y, name).toBeGreaterThanOrEqual(0);
        expect(frame.x + FRAME_SIZE, name).toBeLessThanOrEqual(width);
        expect(frame.y + FRAME_SIZE, name).toBeLessThanOrEqual(height);
      }
    }
    expect(normalized.sheetUrl).toBe("https://example.test/packs/synthetic/sheet.png");
  });

  it("gives the expected still frame for each animation kind", () => {
    const normalized = normalizePack(pack, packBaseUrl);
    expect(normalized.stillOf("wave")).toBe(0);
    expect(normalized.stillOf("rest")).toBe(0);
    expect(normalized.stillOf("exit")).toBe(2);
    expect(normalized.stillOf("blink")).toBe(0);
  });

  it("draws the think animation from pixel positions and the rest from grid indices", () => {
    expect(pack.animations.think?.frames[0]).toEqual({ x: 0, y: FRAME_SIZE, ms: 120 });
    expect(pack.animations.rest?.frames[0]).toEqual({ col: 0, row: 0, ms: 500 });
  });

  it("classic-a.json and classic-b.json describe the same frames as pack.json", () => {
    const classicA = committedJson("classic-a.json") as {
      Name: string;
      Frames: { Duration: number; ImagesOffsets: { Column: number; Row: number } | null }[];
    }[];
    const classicB = committedJson("classic-b.json") as {
      frameWidth: number;
      frameHeight: number;
      animations: Record<string, { frames: { duration: number; position: [number, number] }[]; loop?: boolean }>;
    };

    expect(Array.isArray(classicA)).toBe(true);
    expect(classicB.frameWidth).toBe(FRAME_SIZE);
    expect(classicB.frameHeight).toBe(FRAME_SIZE);

    const fromA = new Map<string, { duration: number; col: number; row: number }[]>();
    for (const entry of classicA) {
      expect(typeof entry.Name).toBe("string");
      const frames = entry.Frames
        .filter((frame) => frame.ImagesOffsets !== null)
        .map((frame) => {
          const offsets = frame.ImagesOffsets as { Column: number; Row: number };
          expect(Number.isInteger(offsets.Column) && offsets.Column >= 0 && offsets.Column < COLUMNS).toBe(true);
          expect(Number.isInteger(offsets.Row) && offsets.Row >= 0 && offsets.Row < ROWS).toBe(true);
          return { duration: frame.Duration, col: offsets.Column, row: offsets.Row };
        });
      fromA.set(entry.Name, frames);
    }

    expect([...fromA.keys()].sort()).toEqual(Object.keys(classicB.animations).sort());
    for (const [name, framesB] of Object.entries(classicB.animations)) {
      const framesA = fromA.get(name) ?? [];
      expect(
        framesB.frames.map((frame) => ({
          duration: frame.duration,
          col: frame.position[0] / FRAME_SIZE,
          row: frame.position[1] / FRAME_SIZE,
        })),
        name,
      ).toEqual(framesA);
    }
  });

  it("covers the default classic role names", () => {
    const names = (committedJson("classic-a.json") as { Name: string }[]).map((entry) => entry.Name);
    for (const name of ["RestPose", "Wave", "GestureLeft", "GestureRight", "GestureUp", "GestureDown", "Explain", "Thinking", "Congratulate", "GoodBye", "Alert"]) {
      expect(names).toContain(name);
    }
    expect(names.filter((name) => name.startsWith("Idle")).length).toBeGreaterThan(0);
  });
});
