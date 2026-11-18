import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { beforeAll, describe, expect, it } from "vitest";
import { normalizePack, resolveRole, validatePack, type AvatarDirection, type AvatarRole } from "../../src/avatar/pack";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const dir = join(root, "src/avatar/thumbtack");
const schemaPath = join(root, "schemas/avatar-pack.v1.schema.json");

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

let frames: FramesModule;
const readJson = (file: string): any => JSON.parse(readFileSync(join(dir, file), "utf8"));
const pack = (): any => readJson("pack.json");

beforeAll(async () => {
  frames = (await import(pathToFileURL(join(dir, "frames.mjs")).href)) as FramesModule;
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
  it("validates against the v1 schema", () => {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    const validate = new Ajv2020({ allErrors: true, strict: true, strictRequired: false }).compile(schema);
    expect(validate(pack()), JSON.stringify(validate.errors)).toBe(true);
  });

  it("validates with validatePack", () => {
    expect(() => validatePack(pack())).not.toThrow();
  });

  it("is exactly what frames.mjs describes", () => {
    expect(pack()).toEqual(frames.buildPack());
  });

  it("declares CC0-1.0", () => {
    expect(pack().license.name).toBe("CC0-1.0");
    expect(pack().license.url).toBe("https://creativecommons.org/publicdomain/zero/1.0/");
  });

  it("defines every animation in the avatar plan", () => {
    expect(Object.keys(pack().animations).sort()).toEqual([...required].sort());
  });

  it("resolves every role to an existing animation", () => {
    const normalized = normalizePack(validatePack(pack()), "https://example.test/thumbtack/pack.json");
    const roles: AvatarRole[] = ["rest", "idle", "greet", "think", "celebrate", "exit", "alert"];
    for (const role of roles) {
      expect(normalized.animations, role).toHaveProperty(resolveRole(normalized, role));
    }
    for (const dir of ["left", "right", "up", "down"] as const) {
      const name = resolveRole(normalized, "point", dir);
      expect(name).toBe(`point-${dir}`);
      expect(normalized.animations).toHaveProperty(name);
    }
    for (const name of normalized.roles.idle as string[]) expect(normalized.animations).toHaveProperty(name);
    expect(normalized.sheetUrl).toBe("https://example.test/thumbtack/sheet.png");
  });

  it("places every frame inside the sheet grid without sharing cells", () => {
    const { sheet, animations } = pack();
    const png = readFileSync(join(dir, "sheet.png"));
    const rows = Math.ceil(frames.frameCount() / sheet.columns);
    const cells = new Set<string>();
    for (const animation of Object.values<any>(animations)) {
      for (const frame of animation.frames) {
        expect(frame.col).toBeLessThan(sheet.columns);
        expect(frame.row).toBeLessThan(rows);
        cells.add(`${frame.col},${frame.row}`);
      }
    }
    expect(cells.size).toBe(frames.frameCount());
    expect(png.readUInt32BE(16)).toBe(sheet.columns * sheet.frameWidth * sheet.scale);
    expect(png.readUInt32BE(20)).toBe(rows * sheet.frameHeight * sheet.scale);
  });

  it("matches the sheet geometry the plan fixes", () => {
    expect(pack().sheet).toEqual({
      src: "./sheet.png",
      frameWidth: 96,
      frameHeight: 96,
      columns: 10,
      scale: 2,
      pixelArt: false,
    });
  });
});

describe("thumbtack sheet.png", () => {
  it("is a PNG under 150 KB", () => {
    const png = readFileSync(join(dir, "sheet.png"));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeLessThan(150 * 1024);
  });
});

describe("thumbtack frames.mjs", () => {
  it("every animation starts and ends on the rest pose", () => {
    const rest = frames.frameSvg(frames.animations["rest"]!.frames[0]!);
    for (const [name, animation] of Object.entries(frames.animations)) {
      expect(frames.frameSvg(animation.frames[0]!), `${name} start`).toBe(rest);
      expect(frames.frameSvg(animation.frames.at(-1)!), `${name} end`).toBe(rest);
    }
  });

  it.each(["left", "right", "up", "down"] as const)("point-%s leans at least 15 degrees toward its side", (side) => {
    const animation = frames.animations[`point-${side}`]!;
    const lean = Math.max(...animation.frames.map((pose) => frames.pointLean[side](pose)));
    expect(lean).toBeGreaterThanOrEqual(15);
  });

  it("every still index is a real frame", () => {
    for (const [name, animation] of Object.entries(frames.animations)) {
      expect(animation.still, name).toBeLessThan(animation.frames.length);
    }
  });

  it("only the think animation loops", () => {
    const looping = Object.entries(frames.animations).filter(([, animation]) => animation.loop).map(([name]) => name);
    expect(looping).toEqual(["think"]);
  });
});

describe("thumbtack svg sources", () => {
  it("are committed for every frame and equal the generator output", () => {
    for (const [name, animation] of Object.entries(frames.animations)) {
      const folder = join(dir, "svg", name);
      expect(readdirSync(folder).sort(), name).toEqual(animation.frames.map((_, i) => `${String(i).padStart(2, "0")}.svg`));
      animation.frames.forEach((pose, i) => {
        expect(readFileSync(join(folder, `${String(i).padStart(2, "0")}.svg`), "utf8")).toBe(frames.frameSvg(pose));
      });
    }
    expect(readdirSync(join(dir, "svg")).sort()).toEqual([...required].sort());
  });

  it("contain no raster or external references", () => {
    for (const name of required) {
      const svg = readFileSync(join(dir, "svg", name, "00.svg"), "utf8");
      expect(svg).not.toMatch(/<image|href=|<text|url\(http/);
    }
  });
});

describe("thumbtack licensing files", () => {
  it("ships LICENSE-ART.md with the CC0 dedication and legal text", () => {
    const text = readFileSync(join(dir, "LICENSE-ART.md"), "utf8");
    expect(text.split("\n")[0]).toContain("released under CC0 1.0");
    expect(text).toContain("CC0 1.0 Universal");
    expect(text).toContain("Statement of Purpose");
  });

  it("has ART.md linking to it and stating the originality rules", () => {
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
