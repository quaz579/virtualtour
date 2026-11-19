import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classicGridSize,
  defaultClassicRoles,
  detectClassicFormat,
  fromClassicColumnRowMap,
  fromClassicPositionMap,
} from "../../src/avatar/classic";
import { AvatarPackError, normalizePack, resolveRole, validatePack } from "../../src/avatar/pack";

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "../../e2e/fixtures/test-pack");
const fixture = (name: string): any => JSON.parse(readFileSync(join(fixtures, name), "utf8"));
const options = { sheetUrl: "https://x.test/sheet.png", frameSize: { w: 32, h: 32 } };

describe("detectClassicFormat", () => {
  it("recognizes both shapes", () => {
    expect(detectClassicFormat(fixture("classic-a.json"))).toBe("column-row");
    expect(detectClassicFormat(fixture("classic-b.json"))).toBe("position");
    expect(detectClassicFormat({ framesize: [10, 10], animations: {} })).toBe("position");
  });

  it.each([
    ["an empty array", []],
    ["items without Frames", [{ Name: "Wave" }]],
    ["a v1 pack", fixture("pack.json")],
    ["an object without a frame size", { animations: {} }],
    ["null", null],
    ["a string", "x"],
  ])("rejects %s", (_label, json) => {
    expect(() => detectClassicFormat(json)).toThrow(AvatarPackError);
  });
});

describe("column/row format", () => {
  it("converts the fixture with the expected frame counts and drops null offsets", () => {
    const pack = fromClassicColumnRowMap(fixture("classic-a.json"), options);
    expect(Object.keys(pack.animations)).toHaveLength(14);
    expect(pack.animations["Wave"]?.frames).toEqual([
      { col: 1, row: 0, ms: 90 },
      { col: 2, row: 0, ms: 90 },
      { col: 3, row: 0, ms: 90 },
    ]);
    expect(pack.animations["GoodBye"]?.frames).toHaveLength(3);
    expect(pack.sheet).toEqual({ src: "https://x.test/sheet.png", frameWidth: 32, frameHeight: 32, columns: 4 });
    expect(() => validatePack(pack)).not.toThrow();
  });

  it("maps default roles from well-known names", () => {
    const pack = fromClassicColumnRowMap(fixture("classic-a.json"), options);
    expect(pack.roles).toEqual({
      rest: "RestPose",
      idle: ["IdleBlink", "IdleWobble", "IdleLook"],
      greet: "Wave",
      think: "Thinking",
      celebrate: "Congratulate",
      exit: "GoodBye",
      alert: "Alert",
      point: { left: "GestureLeft", right: "GestureRight", up: "GestureUp", down: "GestureDown", any: "Explain" },
    });
  });

  it("ignores sound, branching and exit-branch fields", () => {
    const json = [
      {
        Name: "Wave",
        Sound: "x.wav",
        Frames: [
          { Duration: 50, ImagesOffsets: { Column: 0, Row: 0 }, Sound: "a.wav", Branching: { Branches: [] }, ExitBranch: 3 },
          { Duration: 50, Sound: "b.wav" },
        ],
      },
    ];
    const pack = fromClassicColumnRowMap(json, options);
    expect(pack.animations["Wave"]).toEqual({ frames: [{ col: 0, row: 0, ms: 50 }] });
    expect(JSON.stringify(pack)).not.toMatch(/wav|Branch/);
  });

  it("gives the pack the unknown license", () => {
    expect(fromClassicColumnRowMap(fixture("classic-a.json"), options).license).toEqual({
      name: "unknown",
      attribution: "Supplied by the integrator",
    });
  });

  it("applies name and role overrides over the defaults", () => {
    const pack = fromClassicColumnRowMap(fixture("classic-a.json"), {
      ...options,
      name: "Mine",
      roles: { greet: "GoodBye", think: undefined } as never,
    });
    expect(pack.name).toBe("Mine");
    expect(pack.roles.greet).toBe("GoodBye");
    expect(pack.roles.think).toBe("Thinking");
    expect(pack.roles.rest).toBe("RestPose");
  });

  it("requires a frame size", () => {
    expect(() => fromClassicColumnRowMap(fixture("classic-a.json"), { sheetUrl: "s.png" })).toThrow(/frameSize/);
  });

  it("derives the grid size from the largest column and row", () => {
    expect(classicGridSize(fixture("classic-a.json"))).toEqual({ columns: 4, rows: 4 });
    expect(() => classicGridSize([{ Name: "A", Frames: [{ Duration: 1, ImagesOffsets: null }] }])).toThrow(AvatarPackError);
    expect(() => classicGridSize(fixture("classic-b.json"))).toThrow(AvatarPackError);
  });

  it.each([
    ["a fractional column", [{ Name: "A", Frames: [{ Duration: 1, ImagesOffsets: { Column: 0.5, Row: 0 } }] }], /Column/],
    ["a negative row", [{ Name: "A", Frames: [{ Duration: 1, ImagesOffsets: { Column: 0, Row: -1 } }] }], /Row/],
    ["a missing duration", [{ Name: "A", Frames: [{ ImagesOffsets: { Column: 0, Row: 0 } }] }], /Duration/],
    ["only null frames", [{ Name: "A", Frames: [{ Duration: 1, ImagesOffsets: null }] }], /no frame/],
    [
      "a repeated name",
      [
        { Name: "A", Frames: [{ Duration: 1, ImagesOffsets: { Column: 0, Row: 0 } }] },
        { Name: "A", Frames: [{ Duration: 1, ImagesOffsets: { Column: 0, Row: 0 } }] },
      ],
      /repeats/,
    ],
  ])("rejects %s", (_label, json, message) => {
    expect(() => fromClassicColumnRowMap(json, options)).toThrow(message);
  });

  it("clamps a zero duration so the result still validates", () => {
    const pack = fromClassicColumnRowMap([{ Name: "A", Frames: [{ Duration: 0, ImagesOffsets: { Column: 0, Row: 0 } }] }], options);
    expect(() => validatePack(pack)).not.toThrow();
  });

  it("falls back to the first animation for rest and skips missing roles", () => {
    const pack = fromClassicColumnRowMap(
      [{ Name: "Zed", Frames: [{ Duration: 5, ImagesOffsets: { Column: 0, Row: 0 } }] }],
      options,
    );
    expect(pack.roles).toEqual({ rest: "Zed" });
  });

  it("keeps a hostile animation name as data", () => {
    const json = JSON.parse('[{"Name":"__proto__","Frames":[{"Duration":5,"ImagesOffsets":{"Column":0,"Row":0}}]}]');
    const pack = fromClassicColumnRowMap(json, options);
    expect(Object.keys(pack.animations)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(pack.animations)).toBe(Object.prototype);
  });

  it("resolves roles through the normalized pack", () => {
    const pack = normalizePack(validatePack(fromClassicColumnRowMap(fixture("classic-a.json"), options)), "https://x.test/");
    expect(resolveRole(pack, "greet")).toBe("Wave");
    expect(resolveRole(pack, "point", "left")).toBe("GestureLeft");
    expect(resolveRole(pack, "point", "up")).toBe("GestureUp");
    expect(resolveRole(pack, "idle", undefined, "IdleBlink", () => 0)).toBe("IdleWobble");
    expect(pack.frames["Wave"]).toEqual([
      { x: 32, y: 0, ms: 90 },
      { x: 64, y: 0, ms: 90 },
      { x: 96, y: 0, ms: 90 },
    ]);
  });
});

describe("pixel-position format", () => {
  it("converts the fixture with the position spelling", () => {
    const pack = fromClassicPositionMap(fixture("classic-b.json"), { sheetUrl: "https://x.test/sheet.png" });
    expect(Object.keys(pack.animations)).toHaveLength(14);
    expect(pack.animations["Wave"]).toEqual({
      frames: [
        { x: 32, y: 0, ms: 90 },
        { x: 64, y: 0, ms: 90 },
        { x: 96, y: 0, ms: 90 },
      ],
      loop: false,
    });
    expect(pack.sheet).toEqual({ src: "https://x.test/sheet.png", frameWidth: 32, frameHeight: 32 });
    expect(pack.roles.greet).toBe("Wave");
    expect(() => validatePack(pack)).not.toThrow();
  });

  it("accepts framesize and the images spelling, using the first entry", () => {
    const json = {
      framesize: [124, 93],
      overlayCount: 1,
      animations: {
        Wave: { frames: [{ duration: 70, images: [[124, 93], [0, 0]], sound: "x.wav" }], loop: true, useExitBranching: true },
      },
    };
    const pack = fromClassicPositionMap(json, { sheetUrl: "s.png" });
    expect(pack.sheet).toMatchObject({ frameWidth: 124, frameHeight: 93 });
    expect(pack.animations["Wave"]).toEqual({ frames: [{ x: 124, y: 93, ms: 70 }], loop: true });
    expect(JSON.stringify(pack)).not.toMatch(/wav|Branching/);
  });

  it("drops frames with no position and rejects an animation left empty", () => {
    const json = {
      frameWidth: 10,
      frameHeight: 10,
      animations: {
        A: { frames: [{ duration: 5, position: [0, 0] }, { duration: 5, branching: {} }, { duration: 5, images: [] }] },
      },
    };
    expect(fromClassicPositionMap(json, { sheetUrl: "s.png" }).animations["A"]?.frames).toHaveLength(1);
    json.animations.A.frames = [{ duration: 5, branching: {} }] as never;
    expect(() => fromClassicPositionMap(json, { sheetUrl: "s.png" })).toThrow(/no frame/);
  });

  it("lets the caller's frameSize win", () => {
    const pack = fromClassicPositionMap(fixture("classic-b.json"), { sheetUrl: "s.png", frameSize: { w: 64, h: 48 } });
    expect(pack.sheet).toMatchObject({ frameWidth: 64, frameHeight: 48 });
  });

  it.each([
    ["a malformed position", { frames: [{ duration: 1, position: [1] }] }, /\[x, y\]/],
    ["a non-numeric position", { frames: [{ duration: 1, position: ["a", 1] }] }, /finite/],
    ["no frames array", {}, /frames array/],
  ])("rejects %s", (_label, animation, message) => {
    const json = { frameWidth: 8, frameHeight: 8, animations: { A: animation } };
    expect(() => fromClassicPositionMap(json, { sheetUrl: "s.png" })).toThrow(message);
  });

  it("keeps a hostile animation name as data", () => {
    const json = JSON.parse('{"frameWidth":8,"frameHeight":8,"animations":{"__proto__":{"frames":[{"duration":5,"position":[0,0]}]}}}');
    const pack = fromClassicPositionMap(json, { sheetUrl: "s.png" });
    expect(Object.keys(pack.animations)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(pack.animations)).toBe(Object.prototype);
  });
});

describe("defaultClassicRoles", () => {
  it("takes the first matching candidate in table order", () => {
    const roles = defaultClassicRoles({ Default: 1, RestPose: 1, Show: 1, Greeting: 1, GetAttention: 1, Hide: 1, GoodBye: 1, Processing: 1 });
    expect(roles).toMatchObject({ rest: "RestPose", greet: "Greeting", exit: "GoodBye", think: "Processing", alert: "GetAttention" });
    expect(roles.point).toEqual({ any: "GetAttention" });
    expect(defaultClassicRoles({ Default: 1 }).rest).toBe("Default");
    expect(defaultClassicRoles({ Hide: 1 }).exit).toBe("Hide");
  });

  it("matches the Idle prefix only at the start", () => {
    expect(defaultClassicRoles({ A: 1, IdleOne: 1, NotIdle: 1, Idle: 1 }).idle).toEqual(["IdleOne", "Idle"]);
  });
});
