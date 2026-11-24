import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { beforeAll, describe, expect, it } from "vitest";
import { normalizePack, resolveRole, validatePack, type AvatarDirection, type AvatarRole } from "../../src/avatar/pack";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const packDir = join(root, "src/avatar/thumbtack");
const schemaPath = join(root, "schemas/avatar-pack.v1.schema.json");
const variants = ["pushpin", "round"] as const;
type Variant = (typeof variants)[number];

interface Pose {
  tilt: number;
  nod: number;
}

interface FramesModule {
  canvas: { frameWidth: number; frameHeight: number; scale: number; columns: number };
  animations: Record<string, { frames: Pose[]; loop: boolean; still: number }>;
  pointLean: Record<AvatarDirection, (pose: Pose) => number>;
  frameSvg(pose: Pose): string;
  buildPack(): unknown;
  frameCount(): number;
}

let framesByVariant: Record<Variant, FramesModule>;
const variantDir = (variant: Variant): string => (variant === "round" ? join(packDir, "round") : packDir);
const readJson = (variant: Variant, file: string): any => JSON.parse(readFileSync(join(variantDir(variant), file), "utf8"));
const pack = (variant: Variant): any => readJson(variant, "pack.json");

beforeAll(async () => {
  framesByVariant = Object.fromEntries(
    await Promise.all(
      variants.map(async (variant) => [variant, (await import(pathToFileURL(join(variantDir(variant), "frames.mjs")).href)) as FramesModule]),
    ),
  ) as Record<Variant, FramesModule>;
});

const required = [
  "rest",
  "blink",
  "wobble",
  "look-around",
  "wave",
  "point-left",
  "point-right",
  "point-up",
  "point-down",
  "think",
  "cheer",
  "pop-out",
  "boing",
];

describe("thumbtack pack.json", () => {
  it.each(variants)("%s validates against the v1 schema", (variant) => {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    const validate = new Ajv2020({ allErrors: true, strict: true, strictRequired: false }).compile(schema);
    expect(validate(pack(variant)), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each(variants)("%s validates with validatePack", (variant) => {
    expect(() => validatePack(pack(variant))).not.toThrow();
  });

  it.each(variants)("%s is exactly what frames.mjs describes", (variant) => {
    expect(pack(variant)).toEqual(framesByVariant[variant].buildPack());
  });

  it.each(variants)("%s declares CC0-1.0", (variant) => {
    expect(pack(variant).license.name).toBe("CC0-1.0");
    expect(pack(variant).license.url).toBe("https://creativecommons.org/publicdomain/zero/1.0/");
  });

  it.each(variants)("%s defines every animation in the avatar plan", (variant) => {
    expect(Object.keys(pack(variant).animations).sort()).toEqual([...required].sort());
  });

  it.each(variants)("%s has the planned frame count per animation", (variant) => {
    const counts = Object.fromEntries(Object.entries<any>(pack(variant).animations).map(([name, animation]) => [name, animation.frames.length]));
    expect(counts).toEqual({
      rest: 1,
      blink: 4,
      wobble: 8,
      "look-around": 8,
      wave: 8,
      "point-left": 6,
      "point-right": 6,
      "point-up": 6,
      "point-down": 6,
      think: 6,
      cheer: 8,
      "pop-out": 6,
      boing: 6,
    });
  });

  it.each(variants)("%s resolves every role to an existing animation", (variant) => {
    const normalized = normalizePack(validatePack(pack(variant)), `https://example.test/thumbtack/${variant === "round" ? "round/" : ""}pack.json`);
    const roles: AvatarRole[] = ["rest", "idle", "greet", "think", "celebrate", "exit", "alert"];
    for (const role of roles) {
      expect(normalized.animations, role).toHaveProperty(resolveRole(normalized, role));
    }
    for (const side of ["left", "right", "up", "down"] as const) {
      const name = resolveRole(normalized, "point", side);
      expect(name).toBe(`point-${side}`);
      expect(normalized.animations).toHaveProperty(name);
    }
    for (const name of normalized.roles.idle as string[]) expect(normalized.animations).toHaveProperty(name);
    expect(normalized.sheetUrl).toBe(`https://example.test/thumbtack/${variant === "round" ? "round/" : ""}sheet.png`);
  });

  it.each(variants)("%s places every frame inside the sheet grid without sharing cells", (variant) => {
    const { sheet, animations } = pack(variant);
    const png = readFileSync(join(variantDir(variant), "sheet.png"));
    const frameCount = framesByVariant[variant].frameCount();
    const rows = Math.ceil(frameCount / sheet.columns);
    const cells = new Set<string>();
    for (const animation of Object.values<any>(animations)) {
      for (const frame of animation.frames) {
        expect(frame.col).toBeLessThan(sheet.columns);
        expect(frame.row).toBeLessThan(rows);
        cells.add(`${frame.col},${frame.row}`);
      }
    }
    expect(cells.size).toBe(frameCount);
    expect(png.readUInt32BE(16)).toBe(sheet.columns * sheet.frameWidth * sheet.scale);
    expect(png.readUInt32BE(20)).toBe(rows * sheet.frameHeight * sheet.scale);
  });

  it.each(variants)("%s matches the sheet geometry the plan fixes", (variant) => {
    expect(pack(variant).sheet).toEqual({
      src: "./sheet.png",
      frameWidth: 96,
      frameHeight: 96,
      columns: 10,
      scale: 2,
      pixelArt: false,
    });
  });

  it("keeps animation names, frame counts, and roles identical across variants", () => {
    const pushpin = pack("pushpin");
    const round = pack("round");
    const names = (value: any): string[] => Object.keys(value.animations).sort();
    const counts = (value: any): Record<string, number> =>
      Object.fromEntries(Object.entries<any>(value.animations).map(([name, animation]) => [name, animation.frames.length]));
    expect(names(round)).toEqual(names(pushpin));
    expect(counts(round)).toEqual(counts(pushpin));
    expect(round.roles).toEqual(pushpin.roles);
  });
});

describe("thumbtack sheet.png", () => {
  it.each(variants)("%s is a PNG under 150 KB", (variant) => {
    const png = readFileSync(join(variantDir(variant), "sheet.png"));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeLessThan(150 * 1024);
  });
});

describe("thumbtack frames.mjs", () => {
  it.each(variants)("%s animations start and end on the rest pose", (variant) => {
    const frames = framesByVariant[variant];
    const rest = frames.frameSvg(frames.animations["rest"]!.frames[0]!);
    for (const [name, animation] of Object.entries(frames.animations)) {
      expect(frames.frameSvg(animation.frames[0]!), `${name} start`).toBe(rest);
      expect(frames.frameSvg(animation.frames.at(-1)!), `${name} end`).toBe(rest);
    }
  });

  it.each(variants.flatMap((variant) => (["left", "right", "up", "down"] as const).map((side) => [variant, side] as const)))(
    "%s point-%s leans at least 15 degrees toward its side",
    (variant, side) => {
      const animation = framesByVariant[variant].animations[`point-${side}`]!;
      const lean = Math.max(...animation.frames.map((pose) => framesByVariant[variant].pointLean[side](pose)));
      expect(lean).toBeGreaterThanOrEqual(15);
    },
  );

  it.each(variants)("%s has only valid still indices", (variant) => {
    for (const [name, animation] of Object.entries(framesByVariant[variant].animations)) {
      expect(animation.still, name).toBeLessThan(animation.frames.length);
    }
  });

  it.each(variants)("%s only loops the think animation", (variant) => {
    const looping = Object.entries(framesByVariant[variant].animations).filter(([, animation]) => animation.loop).map(([name]) => name);
    expect(looping).toEqual(["think"]);
  });
});

describe("thumbtack svg sources", () => {
  it("are committed for every frame and equal each variant's generator output", () => {
    for (const variant of variants) {
      const frames = framesByVariant[variant];
      const dir = variantDir(variant);
      for (const [name, animation] of Object.entries(frames.animations)) {
        const folder = join(dir, "svg", name);
        expect(readdirSync(folder).sort(), `${variant} ${name}`).toEqual(animation.frames.map((_, i) => `${String(i).padStart(2, "0")}.svg`));
        animation.frames.forEach((pose, i) => {
          expect(readFileSync(join(folder, `${String(i).padStart(2, "0")}.svg`), "utf8")).toBe(frames.frameSvg(pose));
        });
      }
      expect(readdirSync(join(dir, "svg")).sort()).toEqual([...required].sort());
    }
  });

  it("contain no raster or external references", () => {
    for (const variant of variants) {
      const dir = variantDir(variant);
      for (const name of required) {
        for (const file of readdirSync(join(dir, "svg", name))) {
          expect(readFileSync(join(dir, "svg", name, file), "utf8")).not.toMatch(/<image|href=|<text|url\(http/);
        }
      }
    }
  });
});

describe("thumbtack licensing files", () => {
  it("ships one LICENSE-ART.md covering both variants with the CC0 dedication and legal text", () => {
    const text = readFileSync(join(packDir, "LICENSE-ART.md"), "utf8");
    expect(text.split("\n")[0]).toContain("released under CC0 1.0");
    expect(text).toContain("CC0 1.0 Universal");
    expect(text).toContain("Statement of Purpose");
  });

  it("has ART.md linking to the shared license and stating the originality rules", () => {
    const text = readFileSync(join(root, "ART.md"), "utf8");
    expect(text).toContain("src/avatar/thumbtack/LICENSE-ART.md");
    expect(text).toContain("original to this project");
    expect(text).toContain("CC0 1.0");
  });

  it("points LICENSE at the art license in both copies", () => {
    for (const file of [join(root, "LICENSE"), join(root, "../../LICENSE")]) {
      const text = readFileSync(file, "utf8");
      expect(text).toContain("dedicated to the public domain under CC0 1.0");
      expect(text).toContain("src/avatar/thumbtack/LICENSE-ART.md");
    }
  });
});
