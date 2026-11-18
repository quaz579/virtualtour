import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AvatarPackError,
  normalizePack,
  preloadSheet,
  resolveRole,
  validatePack,
  type AvatarPack,
  type NormalizedPack,
} from "../../src/avatar/pack";

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../schemas/avatar-pack.v1.schema.json");

function samplePack(): AvatarPack {
  return {
    format: "virtualtour-avatar/1",
    name: "Sample",
    version: "1.0.0",
    sheet: { src: "./sheet.png", frameWidth: 96, frameHeight: 80, columns: 10, scale: 2, pixelArt: false },
    animations: {
      rest: { frames: [{ col: 0, row: 0, ms: 100 }] },
      wave: {
        frames: [
          { col: 1, row: 0, ms: 90 },
          { col: 2, row: 0, ms: 90 },
          { col: 3, row: 1, ms: 90 },
        ],
        loop: false,
      },
      think: { frames: [{ x: 192, y: 160, ms: 120 }, { x: 384, y: 160, ms: 120 }], loop: true },
      blink: { frames: [{ col: 4, row: 0, ms: 80 }] },
      wobble: { frames: [{ col: 5, row: 0, ms: 80 }] },
      look: { frames: [{ col: 6, row: 0, ms: 80 }] },
      "point-left": { frames: [{ col: 7, row: 0, ms: 80 }] },
      "point-down": { frames: [{ col: 8, row: 0, ms: 80 }] },
      "point-any": { frames: [{ col: 9, row: 0, ms: 80 }] },
    },
    roles: {
      rest: "rest",
      idle: ["blink", "wobble", "look"],
      greet: "wave",
      point: { left: "point-left", down: "point-down", any: "point-any" },
      think: "think",
    },
    bubble: { dock: "end", gap: 8 },
    license: { name: "CC0-1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/", attribution: "none" },
  };
}

function mutate(edit: (pack: Record<string, any>) => void): unknown {
  const copy = JSON.parse(JSON.stringify(samplePack())) as Record<string, any>;
  edit(copy);
  return copy;
}

function pathOf(json: unknown): string {
  try {
    validatePack(json);
  } catch (error) {
    expect(error).toBeInstanceOf(AvatarPackError);
    return (error as AvatarPackError).path;
  }
  throw new Error("expected validatePack to throw");
}

describe("validatePack", () => {
  it("accepts a valid pack", () => {
    expect(validatePack(samplePack())).toEqual(samplePack());
  });

  it("accepts a minimal pack", () => {
    const minimal = {
      format: "virtualtour-avatar/1",
      name: "Min",
      sheet: { src: "s.png", frameWidth: 1, frameHeight: 1 },
      animations: { rest: { frames: [{ col: 0, row: 0, ms: 1 }] } },
      roles: { rest: "rest" },
    };
    expect(validatePack(minimal)).toEqual(minimal);
  });

  it.each<[string, string, (pack: Record<string, any>) => void]>([
    ["wrong format", "format", (p) => (p.format = "virtualtour-avatar/2")],
    ["empty name", "name", (p) => (p.name = "")],
    ["missing sheet", "sheet", (p) => delete p.sheet],
    ["missing sheet.src", "sheet.src", (p) => delete p.sheet.src],
    ["zero frameWidth", "sheet.frameWidth", (p) => (p.sheet.frameWidth = 0)],
    ["negative frameHeight", "sheet.frameHeight", (p) => (p.sheet.frameHeight = -4)],
    ["fractional columns", "sheet.columns", (p) => (p.sheet.columns = 2.5)],
    ["zero scale", "sheet.scale", (p) => (p.sheet.scale = 0)],
    ["non-boolean pixelArt", "sheet.pixelArt", (p) => (p.sheet.pixelArt = "yes")],
    ["unknown sheet key", "sheet.depth", (p) => (p.sheet.depth = 1)],
    ["unknown top-level key", "extra", (p) => (p.extra = 1)],
    ["no animations", "animations", (p) => (p.animations = {})],
    ["empty frames", "animations.wave.frames", (p) => (p.animations.wave.frames = [])],
    ["zero ms", "animations.wave.frames[2].ms", (p) => (p.animations.wave.frames[2].ms = 0)],
    ["string ms", "animations.wave.frames[1].ms", (p) => (p.animations.wave.frames[1].ms = "90")],
    ["no position", "animations.wave.frames[0]", (p) => (p.animations.wave.frames[0] = { ms: 5 })],
    ["col and x together", "animations.wave.frames[0]", (p) => (p.animations.wave.frames[0].x = 3)],
    ["col without row", "animations.wave.frames[0].row", (p) => delete p.animations.wave.frames[0].row],
    ["x without y", "animations.think.frames[0].y", (p) => delete p.animations.think.frames[0].y],
    ["negative col", "animations.wave.frames[0].col", (p) => (p.animations.wave.frames[0].col = -1)],
    ["fractional row", "animations.wave.frames[0].row", (p) => (p.animations.wave.frames[0].row = 0.5)],
    ["still past the end", "animations.wave.still", (p) => (p.animations.wave.still = 3)],
    ["non-boolean loop", "animations.wave.loop", (p) => (p.animations.wave.loop = 1)],
    ["unknown animation key", "animations.wave.speed", (p) => (p.animations.wave.speed = 2)],
    ["missing roles", "roles", (p) => delete p.roles],
    ["missing roles.rest", "roles.rest", (p) => delete p.roles.rest],
    ["rest names nothing", "roles.rest", (p) => (p.roles.rest = "nope")],
    ["greet names nothing", "roles.greet", (p) => (p.roles.greet = "nope")],
    ["idle entry names nothing", "roles.idle[1]", (p) => (p.roles.idle[1] = "nope")],
    ["idle string names nothing", "roles.idle", (p) => (p.roles.idle = "nope")],
    ["point.left names nothing", "roles.point.left", (p) => (p.roles.point.left = "nope")],
    ["inherited name is not an animation", "roles.think", (p) => (p.roles.think = "constructor")],
    ["empty idle list", "roles.idle", (p) => (p.roles.idle = [])],
    ["unknown role", "roles.dance", (p) => (p.roles.dance = "wave")],
    ["unknown point key", "roles.point.sideways", (p) => (p.roles.point.sideways = "wave")],
    ["bad dock", "bubble.dock", (p) => (p.bubble.dock = "middle")],
    ["bad gap", "bubble.gap", (p) => (p.bubble.gap = "8")],
    ["bad license name", "license.name", (p) => (p.license.name = 5)],
    ["bad version", "version", (p) => (p.version = 1)],
  ])("rejects %s at %s", (_label, path, edit) => {
    expect(pathOf(mutate(edit))).toBe(path);
  });

  it.each([null, "pack", 3, [], undefined])("rejects non-object input %j", (input) => {
    expect(pathOf(input)).toBe("$");
  });

  it("puts the path in the message", () => {
    const error = new AvatarPackError("animations.wave.frames[2].ms", "must be greater than 0");
    expect(error.message).toBe("animations.wave.frames[2].ms: must be greater than 0");
    expect(error.name).toBe("AvatarPackError");
    expect(error).toBeInstanceOf(Error);
  });

  it("keeps __proto__ animation names as data", () => {
    const json = JSON.parse(
      '{"format":"virtualtour-avatar/1","name":"P","sheet":{"src":"s.png","frameWidth":1,"frameHeight":1},' +
        '"animations":{"rest":{"frames":[{"col":0,"row":0,"ms":1}]},"__proto__":{"frames":[{"col":1,"row":0,"ms":1}]}},' +
        '"roles":{"rest":"rest","greet":"__proto__"}}',
    ) as unknown;
    const pack = validatePack(json);
    expect(Object.keys(pack.animations)).toEqual(["rest", "__proto__"]);
    expect(Object.getPrototypeOf(pack.animations)).toBe(Object.prototype);
    expect(normalizePack(pack, "https://x.test/p.json").frames["__proto__"]).toEqual([{ x: 1, y: 0, ms: 1 }]);
  });
});

describe("normalizePack", () => {
  const base = "https://cdn.example.test/packs/sample/pack.json";
  const normalized = (): NormalizedPack => normalizePack(validatePack(samplePack()), base);

  it("turns col/row into CSS pixel offsets", () => {
    expect(normalized().frames.wave).toEqual([
      { x: 96, y: 0, ms: 90 },
      { x: 192, y: 0, ms: 90 },
      { x: 288, y: 80, ms: 90 },
    ]);
  });

  it("divides x/y image pixels by the sheet scale", () => {
    expect(normalized().frames.think).toEqual([
      { x: 96, y: 80, ms: 120 },
      { x: 192, y: 80, ms: 120 },
    ]);
  });

  it("treats a missing scale as 1", () => {
    const pack = samplePack();
    delete pack.sheet.scale;
    expect(normalizePack(pack, base).frames.think?.[0]).toEqual({ x: 192, y: 160, ms: 120 });
  });

  it("resolves the sheet url against the pack url", () => {
    expect(normalized().sheetUrl).toBe("https://cdn.example.test/packs/sample/sheet.png");
    const pack = samplePack();
    pack.sheet.src = "../shared/sheet.png";
    expect(normalizePack(pack, base).sheetUrl).toBe("https://cdn.example.test/packs/shared/sheet.png");
    pack.sheet.src = "https://other.test/a.png";
    expect(normalizePack(pack, base).sheetUrl).toBe("https://other.test/a.png");
  });

  it("resolves against the page when the base url is relative", () => {
    const url = normalizePack(samplePack(), "/packs/pack.json").sheetUrl;
    expect(url).toBe(new URL("/packs/sheet.png", location.href).href);
  });

  it("keeps the input pack fields and does not mutate it", () => {
    const pack = samplePack();
    const out = normalizePack(pack, base);
    expect(out.name).toBe("Sample");
    expect(out.roles).toBe(pack.roles);
    expect(pack).toEqual(samplePack());
  });

  it("defaults still to the last frame for non-loop and 0 for loop", () => {
    const n = normalized();
    expect(n.stillOf("wave")).toBe(2);
    expect(n.stillOf("think")).toBe(0);
    expect(n.stillOf("rest")).toBe(0);
  });

  it("honors an explicit still", () => {
    const pack = samplePack();
    pack.animations.wave!.still = 1;
    pack.animations.think!.still = 1;
    const n = normalizePack(pack, base);
    expect(n.stillOf("wave")).toBe(1);
    expect(n.stillOf("think")).toBe(1);
  });

  it("throws for an unknown animation name", () => {
    expect(() => normalized().stillOf("toString")).toThrow(AvatarPackError);
  });
});

describe("resolveRole", () => {
  const pack = (edit?: (p: AvatarPack) => void): NormalizedPack => {
    const p = samplePack();
    edit?.(p);
    return normalizePack(p, "https://x.test/pack.json");
  };

  it("resolves plain roles and falls back to rest", () => {
    const n = pack();
    expect(resolveRole(n, "rest")).toBe("rest");
    expect(resolveRole(n, "greet")).toBe("wave");
    expect(resolveRole(n, "think")).toBe("think");
    expect(resolveRole(n, "celebrate")).toBe("rest");
    expect(resolveRole(n, "exit")).toBe("rest");
    expect(resolveRole(n, "alert")).toBe("rest");
  });

  it("walks the point fallback chain", () => {
    const n = pack();
    expect(resolveRole(n, "point", "left")).toBe("point-left");
    expect(resolveRole(n, "point", "down")).toBe("point-down");
    expect(resolveRole(n, "point", "right")).toBe("point-any");
    expect(resolveRole(n, "point", "up")).toBe("point-any");
    expect(resolveRole(n, "point")).toBe("point-any");
    const noAny = pack((p) => delete p.roles.point!.any);
    expect(resolveRole(noAny, "point", "right")).toBe("wave");
    const noGreet = pack((p) => {
      delete p.roles.point;
      delete p.roles.greet;
    });
    expect(resolveRole(noGreet, "point", "left")).toBe("rest");
  });

  it("picks idle deterministically under an injected rng", () => {
    const n = pack();
    expect(resolveRole(n, "idle", undefined, undefined, () => 0)).toBe("blink");
    expect(resolveRole(n, "idle", undefined, undefined, () => 0.5)).toBe("wobble");
    expect(resolveRole(n, "idle", undefined, undefined, () => 0.99)).toBe("look");
    expect(resolveRole(n, "idle", undefined, undefined, () => 1)).toBe("look");
  });

  it("never returns the avoided idle when there is another choice", () => {
    const n = pack();
    for (const roll of [0, 0.2, 0.5, 0.8, 0.999]) {
      expect(resolveRole(n, "idle", undefined, "blink", () => roll)).not.toBe("blink");
      expect(resolveRole(n, "idle", undefined, "look", () => roll)).not.toBe("look");
    }
    expect(resolveRole(n, "idle", undefined, "blink", () => 0)).toBe("wobble");
  });

  it("returns the only idle even when it is the avoided one", () => {
    const single = pack((p) => (p.roles.idle = "blink"));
    expect(resolveRole(single, "idle", undefined, "blink")).toBe("blink");
  });

  it("falls back to rest when there is no idle role", () => {
    expect(resolveRole(pack((p) => delete p.roles.idle), "idle")).toBe("rest");
  });

  it("uses Math.random when no rng is given", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(resolveRole(pack(), "idle")).toBe("wobble");
    spy.mockRestore();
  });
});

describe("preloadSheet", () => {
  const originalImage = globalThis.Image;
  afterEach(() => {
    globalThis.Image = originalImage;
  });

  function stubImage(outcome: "load" | "error", decode?: () => Promise<void>): string[] {
    const requested: string[] = [];
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = decode;
      set src(value: string) {
        requested.push(value);
        queueMicrotask(() => (outcome === "load" ? this.onload?.() : this.onerror?.()));
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;
    return requested;
  }

  it("resolves after the image loads and decodes", async () => {
    const decode = vi.fn(() => Promise.resolve());
    const requested = stubImage("load", decode);
    await expect(preloadSheet("https://x.test/sheet.png")).resolves.toBeUndefined();
    expect(requested).toEqual(["https://x.test/sheet.png"]);
    expect(decode).toHaveBeenCalledOnce();
  });

  it("resolves when decode is unavailable", async () => {
    stubImage("load");
    await expect(preloadSheet("https://x.test/sheet.png")).resolves.toBeUndefined();
  });

  it("rejects on a load error such as a 404", async () => {
    stubImage("error");
    await expect(preloadSheet("https://x.test/missing.png")).rejects.toMatchObject({
      name: "AvatarPackError",
      path: "sheet.src",
    });
  });

  it("still resolves when decode rejects after a successful load", async () => {
    stubImage("load", () => Promise.reject(new Error("bad image")));
    await expect(preloadSheet("https://x.test/odd.png")).resolves.toBeUndefined();
  });
});

describe("avatar-pack.v1.schema.json", () => {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true, strictRequired: false }).compile(schema);

  it("accepts the valid fixtures that validatePack accepts", () => {
    expect(validate(samplePack())).toBe(true);
    expect(validate(JSON.parse(JSON.stringify(samplePack())))).toBe(true);
  });

  it.each<[string, (pack: Record<string, any>) => void]>([
    ["wrong format", (p) => (p.format = "other/1")],
    ["no animations", (p) => (p.animations = {})],
    ["frame with both col and x", (p) => (p.animations.wave.frames[0].x = 1)],
    ["frame with zero ms", (p) => (p.animations.wave.frames[0].ms = 0)],
    ["missing roles.rest", (p) => delete p.roles.rest],
    ["unknown top-level key", (p) => (p.extra = true)],
    ["bad dock", (p) => (p.bubble.dock = "middle")],
    ["empty idle list", (p) => (p.roles.idle = [])],
  ])("rejects a malformed pack: %s", (_label, edit) => {
    const bad = mutate(edit);
    expect(validate(bad)).toBe(false);
    expect(() => validatePack(bad)).toThrow(AvatarPackError);
  });
});
