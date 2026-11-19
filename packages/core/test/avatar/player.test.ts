import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarPackError, normalizePack, validatePack } from "../../src/avatar/pack";
import type { AvatarPack } from "../../src/avatar/pack";
import { SpritePlayer } from "../../src/avatar/player";

let queue: Map<number, FrameRequestCallback>;
let nextId: number;
let clock: number;
let requested: number;
let players: SpritePlayer[];

function advanceTo(ms: number): void {
  clock = ms;
  const pending = Array.from(queue.values());
  queue.clear();
  for (const callback of pending) callback(clock);
}

beforeEach(() => {
  queue = new Map();
  nextId = 1;
  clock = 0;
  requested = 0;
  players = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    requested += 1;
    queue.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queue.delete(id);
  });
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
  for (const player of players) player.dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const definition: AvatarPack = {
  format: "virtualtour-avatar/1",
  name: "unit",
  sheet: { src: "sheet.png", frameWidth: 32, frameHeight: 24, columns: 4 },
  animations: {
    rest: { frames: [{ col: 0, row: 0, ms: 500 }], loop: true },
    wave: {
      frames: [
        { col: 1, row: 0, ms: 100 },
        { col: 2, row: 0, ms: 50 },
        { col: 3, row: 1, ms: 200 },
      ],
      still: 1,
    },
    spin: {
      frames: [
        { col: 0, row: 2, ms: 100 },
        { col: 1, row: 2, ms: 100 },
      ],
      loop: true,
    },
    blink: { frames: [{ col: 2, row: 2, ms: 80 }] },
    wobble: { frames: [{ col: 3, row: 2, ms: 80 }] },
    "point-left": { frames: [{ col: 0, row: 3, ms: 80 }] },
    nudge: { frames: [{ col: 1, row: 3, ms: 80 }] },
    dash: {
      frames: [
        { col: 2, row: 3, ms: 50 },
        { col: 3, row: 3, ms: 50 },
      ],
    },
  },
  roles: { rest: "rest", idle: ["blink", "wobble"], greet: "wave", point: { left: "point-left" }, alert: "nudge" },
};

function make(overrides: { reduced?: () => boolean; random?: () => number; pack?: AvatarPack } = {}) {
  const pack = normalizePack(validatePack(overrides.pack ?? definition), "https://example.test/p/pack.json");
  const el = document.createElement("div");
  document.body.appendChild(el);
  const opts: { reducedMotion?: () => boolean; random?: () => number } = {};
  if (overrides.reduced) opts.reducedMotion = overrides.reduced;
  if (overrides.random) opts.random = overrides.random;
  const player = new SpritePlayer(pack, el, opts);
  players.push(player);
  return { pack, el, player };
}

const pos = (el: HTMLElement): string => el.style.backgroundPosition;

describe("SpritePlayer element", () => {
  it("sizes the element, sets the sheet and shows the rest frame", () => {
    const { el } = make();
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.style.width).toBe("32px");
    expect(el.style.height).toBe("24px");
    expect(el.style.backgroundImage).toContain("https://example.test/p/sheet.png");
    expect(el.style.backgroundRepeat).toBe("no-repeat");
    expect(pos(el)).toBe("0px 0px");
    expect(el.style.imageRendering).toBe("");
  });

  it("applies pixel-art rendering and a scaled background size only when asked", () => {
    const { el } = make({
      pack: { ...definition, sheet: { ...definition.sheet, pixelArt: true, scale: 2, columns: 4 } },
    });
    expect(el.style.imageRendering).toBe("pixelated");
    expect(el.style.backgroundSize).toBe("128px auto");
  });

  it("escapes quotes, backslashes and newlines in the sheet URL", () => {
    const { pack } = make();
    const hostile = { ...pack, sheetUrl: "https://example.test/a'b\\c\nd.png" };
    const el = document.createElement("div");
    const set = vi.spyOn(el.style, "backgroundImage", "set");
    new SpritePlayer(hostile, el);
    expect(set).toHaveBeenCalledWith("url('https://example.test/a\\'b\\\\c\\a d.png')");
  });

  it("an escaped quote cannot break out of url()", () => {
    const { pack } = make();
    const el = document.createElement("div");
    const set = vi.spyOn(el.style, "backgroundImage", "set");
    new SpritePlayer({ ...pack, sheetUrl: "x');background:red;('" }, el);
    expect(set).toHaveBeenCalledWith("url('x\\');background:red;(\\'')");
  });
});

describe("SpritePlayer timing", () => {
  it("steps through frames by the cumulative duration table", async () => {
    const { el, player } = make();
    const done = player.play("wave");
    expect(player.current).toBe("wave");
    expect(pos(el)).toBe("-32px 0px");
    advanceTo(99);
    expect(pos(el)).toBe("-32px 0px");
    advanceTo(100);
    expect(pos(el)).toBe("-64px 0px");
    advanceTo(149);
    expect(pos(el)).toBe("-64px 0px");
    advanceTo(150);
    expect(pos(el)).toBe("-96px -24px");
    advanceTo(349);
    expect(pos(el)).toBe("-96px -24px");
    let settled = false;
    void done.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    advanceTo(350);
    await done;
    expect(player.current).toBeNull();
    expect(pos(el)).toBe("-64px 0px");
    expect(queue.size).toBe(0);
  });

  it("drops frames on a late tick instead of replaying them", () => {
    const { el, player } = make();
    void player.play("wave");
    advanceTo(160);
    expect(pos(el)).toBe("-96px -24px");
  });

  it("ends a non-loop animation without a still on its last frame", async () => {
    const { el, player } = make();
    const done = player.play("dash");
    advanceTo(50);
    expect(pos(el)).toBe("-96px -72px");
    advanceTo(100);
    await done;
    expect(pos(el)).toBe("-96px -72px");
  });

  it("wraps a looping animation and keeps running", async () => {
    const { el, player } = make();
    let resolved = false;
    void player.play("spin").then(() => (resolved = true));
    advanceTo(100);
    expect(pos(el)).toBe("-32px -48px");
    advanceTo(200);
    expect(pos(el)).toBe("0px -48px");
    advanceTo(1150);
    expect(pos(el)).toBe("-32px -48px");
    advanceTo(1250);
    expect(pos(el)).toBe("0px -48px");
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(player.current).toBe("spin");
  });

  it("opts.loop overrides the animation flag in both directions", async () => {
    const { player } = make();
    let resolved = false;
    void player.play("wave", { loop: true }).then(() => (resolved = true));
    advanceTo(1000);
    await Promise.resolve();
    expect(resolved).toBe(false);
    const once = player.play("spin", { loop: false });
    advanceTo(1200);
    await once;
    expect(player.current).toBeNull();
  });

  it("interrupting with another play resolves the first promise and starts the second", async () => {
    const { el, player } = make();
    const first = player.play("spin");
    advanceTo(50);
    const second = player.play("wave");
    await first;
    expect(player.current).toBe("wave");
    expect(pos(el)).toBe("-32px 0px");
    advanceTo(150);
    expect(pos(el)).toBe("-64px 0px");
    advanceTo(400);
    await second;
  });

  it("stop resolves the promise, shows rest and unsubscribes", async () => {
    const { el, player } = make();
    const done = player.play("wave");
    advanceTo(120);
    player.stop();
    await done;
    expect(player.current).toBeNull();
    expect(pos(el)).toBe("0px 0px");
    expect(queue.size).toBe(0);
  });

  it("hidden-tab time does not advance a one-shot animation", () => {
    const { el, player } = make();
    let hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    try {
      void player.play("wave");
      advanceTo(40);
      hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
      clock = 10_040;
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
      advanceTo(10_050);
      expect(pos(el)).toBe("-32px 0px");
      advanceTo(10_100);
      expect(pos(el)).toBe("-64px 0px");
      expect(player.current).toBe("wave");
    } finally {
      delete (document as unknown as Record<string, unknown>)["hidden"];
    }
  });

  it("never uses setTimeout or setInterval", () => {
    const timeout = vi.spyOn(globalThis, "setTimeout");
    const interval = vi.spyOn(globalThis, "setInterval");
    const { player } = make();
    void player.play("wave");
    advanceTo(400);
    void player.playRole("idle");
    advanceTo(600);
    expect(timeout).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
  });
});

describe("SpritePlayer reduced motion", () => {
  it("shows the still frame and resolves immediately without subscribing", async () => {
    const { el, player } = make({ reduced: () => true });
    await player.play("wave");
    expect(pos(el)).toBe("-64px 0px");
    expect(player.current).toBeNull();
    expect(requested).toBe(0);
    await player.play("spin");
    expect(pos(el)).toBe("0px -48px");
  });

  it("is re-read on every play", async () => {
    let reduced = true;
    const { el, player } = make({ reduced: () => reduced });
    await player.play("wave");
    expect(requested).toBe(0);
    reduced = false;
    void player.play("wave");
    expect(requested).toBe(1);
    advanceTo(150);
    expect(pos(el)).toBe("-96px -24px");
  });

  it("interrupts a running animation when reduced motion turns on", async () => {
    let reduced = false;
    const { el, player } = make({ reduced: () => reduced });
    const running = player.play("spin");
    reduced = true;
    await player.play("wave");
    await running;
    expect(pos(el)).toBe("-64px 0px");
    expect(queue.size).toBe(0);
  });

  it("defaults to the library prefersReducedMotion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const { el, player } = make();
    await player.play("wave");
    expect(pos(el)).toBe("-64px 0px");
    expect(requested).toBe(0);
  });
});

describe("SpritePlayer roles, stills and errors", () => {
  it("playRole resolves point direction, greet and fallbacks", () => {
    const { player } = make();
    void player.playRole("point", "left");
    expect(player.current).toBe("point-left");
    void player.playRole("point", "up");
    expect(player.current).toBe("wave");
    void player.playRole("alert");
    expect(player.current).toBe("nudge");
    void player.playRole("exit");
    expect(player.current).toBe("rest");
  });

  it("playRole idle never repeats the previous idle and uses the injected random", () => {
    const { player } = make({ random: () => 0.99 });
    void player.playRole("idle");
    const first = player.current;
    expect(first).toBe("wobble");
    void player.playRole("idle");
    expect(player.current).toBe("blink");
    void player.playRole("idle");
    expect(player.current).toBe("wobble");
  });

  it("still shows an animation's still frame and interrupts a run", async () => {
    const { el, player } = make();
    const running = player.play("spin");
    player.still("wave");
    await running;
    expect(player.current).toBeNull();
    expect(pos(el)).toBe("-64px 0px");
    player.still("spin");
    expect(pos(el)).toBe("0px -48px");
  });

  it("still throws AvatarPackError for unknown names including prototype keys", () => {
    const { player } = make();
    expect(() => player.still("nope")).toThrow(AvatarPackError);
    expect(() => player.still("constructor")).toThrow(AvatarPackError);
  });

  it("play rejects for unknown names without disturbing the running animation", async () => {
    const { player } = make();
    void player.play("spin");
    await expect(player.play("nope")).rejects.toBeInstanceOf(AvatarPackError);
    await expect(player.play("__proto__")).rejects.toBeInstanceOf(AvatarPackError);
    expect(player.current).toBe("spin");
  });

  it("keeps state when the element moves between parents", () => {
    const { el, player } = make();
    void player.play("wave");
    advanceTo(100);
    const other = document.createElement("section");
    document.body.appendChild(other);
    other.appendChild(el);
    advanceTo(150);
    expect(pos(el)).toBe("-96px -24px");
    expect(player.current).toBe("wave");
  });
});

describe("SpritePlayer dispose", () => {
  it("resolves pending plays, unsubscribes, clears inline styles and ignores later calls", async () => {
    const { el, player } = make();
    const running = player.play("spin");
    player.dispose();
    await running;
    expect(queue.size).toBe(0);
    expect(el.getAttribute("style") ?? "").toBe("");
    expect(el.hasAttribute("aria-hidden")).toBe(false);
    await player.play("wave");
    player.stop();
    player.still("wave");
    player.dispose();
    expect(queue.size).toBe(0);
    expect(el.getAttribute("style") ?? "").toBe("");
  });
});
