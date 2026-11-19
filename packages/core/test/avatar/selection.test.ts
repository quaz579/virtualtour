import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { Tour } from "../../src/index";
import { withAvatar } from "../../src/avatar/with-avatar";
import { SpeakerPresenter } from "../../src/avatar/speaker";
import type { AvatarOptions } from "../../src/avatar/speaker";
import { AvatarPackError, normalizePack, validatePack } from "../../src/avatar/pack";
import type { AvatarPack } from "../../src/avatar/pack";
import { pointDirection, resolveAnimation } from "../../src/avatar/select";
import { setCurrentTour } from "../../src/registry";
import type { StepConfig, TourConfig } from "../../src/types";

const frame = vi.hoisted(() => ({ callbacks: new Set<(now: number) => void>() }));

vi.mock("../../src/dom/frame", () => ({
  subscribe: (callback: (now: number) => void) => {
    frame.callbacks.add(callback);
    return () => frame.callbacks.delete(callback);
  },
}));

const frames = (ms: number) => [{ col: 0, row: 0, ms }];
const definition: AvatarPack = {
  format: "virtualtour-avatar/1",
  name: "unit",
  sheet: { src: "sheet.png", frameWidth: 32, frameHeight: 32, columns: 4 },
  animations: {
    rest: { frames: frames(500), loop: true },
    wave: { frames: frames(100) },
    hello: { frames: frames(100) },
    "point-left": { frames: frames(100) },
    "point-right": { frames: frames(100) },
    "point-up": { frames: frames(100) },
    "point-down": { frames: frames(100) },
    "point-any": { frames: frames(100) },
    think: { frames: frames(100), loop: true },
    cheer: { frames: frames(100) },
    boing: { frames: frames(100) },
    calm: { frames: frames(100) },
  },
  roles: {
    rest: "rest",
    greet: "wave",
    point: { left: "point-left", right: "point-right", up: "point-up", down: "point-down", any: "point-any" },
    think: "think",
    celebrate: "cheer",
    alert: "boing",
  },
};

const pack = (extra: Partial<AvatarPack> = {}) => normalizePack(validatePack({ ...definition, ...extra }), "http://localhost/");

let clock: number;
let avatarRect: DOMRect;
let targetRect: DOMRect;
let reduced: boolean;
const created: Tour[] = [];

function advance(ms: number): void {
  clock += ms;
  for (const callback of Array.from(frame.callbacks)) callback(clock);
}

beforeEach(() => {
  frame.callbacks.clear();
  clock = 0;
  reduced = false;
  avatarRect = new DOMRect(100, 100, 32, 32);
  targetRect = new DOMRect(500, 100, 100, 32);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  const target = document.createElement("button");
  target.id = "target";
  document.body.append(target);
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.classList.contains("vt-avatar")) return avatarRect;
    if (this.classList.contains("vt-bubble")) return new DOMRect(0, 0, 150, 100);
    if (this.classList.contains("vt-popover")) return new DOMRect(0, 0, 200, 100);
    if (this.id === "target") return targetRect;
    return new DOMRect();
  });
});

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const anim = () => document.querySelector<HTMLElement>(".vt-avatar")?.getAttribute("data-vt-anim");
const wrapper = () => document.querySelector<HTMLElement>(".vt-popover") as HTMLElement;
const plain: StepConfig = { id: "p", title: "Plain", body: "No target" };
const pointing: StepConfig = { id: "t", title: "Target", body: "Here", target: "#target", placement: { side: "bottom" } };

function make(steps: StepConfig[], options: AvatarOptions = {}, extra: TourConfig = {}, avatar: AvatarPack | Promise<AvatarPack> = pack()): Tour {
  const tour = createTour({ animate: false, steps, presenter: withAvatar(avatar, options), ...extra });
  created.push(tour);
  return tour;
}

function fading(steps: StepConfig[]): Tour {
  const tour = createTour({ animate: false, steps, presenter: (t) => new SpeakerPresenter(t, pack(), { fadeMs: 400 }) });
  created.push(tour);
  return tour;
}

describe("pointDirection", () => {
  it.each([
    [{ x: 0, y: 0 }, { x: 10, y: 2 }, "right"],
    [{ x: 0, y: 0 }, { x: -10, y: 2 }, "left"],
    [{ x: 0, y: 0 }, { x: 2, y: 10 }, "down"],
    [{ x: 0, y: 0 }, { x: 2, y: -10 }, "up"],
    [{ x: 0, y: 0 }, { x: 5, y: 5 }, "right"],
    [{ x: 0, y: 0 }, { x: -5, y: -5 }, "left"],
    [{ x: 0, y: 0 }, { x: 0, y: 0 }, "right"],
  ] as const)("%j to %j points %s", (from, to, expected) => {
    expect(pointDirection(from, to)).toBe(expected);
  });
});

describe("resolveAnimation", () => {
  const p = pack();
  it("prefers a pack animation over a role of the same name", () => {
    const custom = pack({ roles: { ...definition.roles, greet: "hello" }, animations: { ...definition.animations, greet: { frames: frames(10) } } });
    expect(resolveAnimation(custom, "greet")).toBe("greet");
    expect(resolveAnimation(custom, "wave")).toBe("wave");
  });
  it("resolves roles and role paths", () => {
    expect(resolveAnimation(p, "greet")).toBe("wave");
    expect(resolveAnimation(p, "celebrate")).toBe("cheer");
    expect(resolveAnimation(p, "point", "up")).toBe("point-up");
    expect(resolveAnimation(p, "point.left")).toBe("point-left");
    expect(resolveAnimation(p, "point.any")).toBe("point-any");
  });
  it("rejects what is neither", () => {
    expect(resolveAnimation(p, "dance")).toBeUndefined();
    expect(resolveAnimation(p, "point.sideways")).toBeUndefined();
    expect(resolveAnimation(p, "toString")).toBeUndefined();
  });
});

describe("animation selection", () => {
  it("greets on a first step without a target", async () => {
    const tour = make([plain, pointing]);
    await tour.start();
    expect(anim()).toBe("wave");
  });

  it.each([
    ["right", new DOMRect(500, 100, 100, 32), "point-right"],
    ["left", new DOMRect(-300, 100, 100, 32), "point-left"],
    ["down", new DOMRect(100, 500, 32, 100), "point-down"],
    ["up", new DOMRect(100, -300, 32, 100), "point-up"],
    ["a tie, horizontally", new DOMRect(300, 300, 32, 32), "point-right"],
  ])("points %s at a target", async (_label, rect, expected) => {
    targetRect = rect;
    const tour = make([pointing]);
    await tour.start();
    expect(anim()).toBe(expected);
  });

  it("points on a first step that has a target, not greets", async () => {
    const tour = make([pointing]);
    await tour.start();
    expect(anim()).toBe("point-right");
  });

  it("uses the default animation, else rest, on a later step without a target", async () => {
    const withDefault = make([pointing, plain], { defaultAnimation: "calm" });
    await withDefault.start();
    await withDefault.forward();
    expect(anim()).toBe("calm");
    withDefault.finish();
    const without = make([pointing, plain]);
    await without.start();
    await without.forward();
    expect(anim()).toBe("rest");
  });

  it("lets an explicit name, role or role path win", async () => {
    const tour = make([
      { ...pointing, id: "a", extensions: { avatar: { animation: "boing" } } },
      { ...pointing, id: "b", extensions: { avatar: { animation: "think" } } },
      { ...pointing, id: "c", extensions: { avatar: { animation: "celebrate" } } },
      { ...pointing, id: "d", extensions: { avatar: { animation: "point.up" } } },
    ]);
    await tour.start();
    expect(anim()).toBe("boing");
    await tour.forward();
    expect(anim()).toBe("think");
    await tour.forward();
    expect(anim()).toBe("cheer");
    await tour.forward();
    expect(anim()).toBe("point-up");
  });

  it("falls back to the automatic choice and warns for an unknown explicit animation", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = make([{ ...pointing, extensions: { avatar: { animation: "dance" } } }]);
    await tour.start();
    expect(anim()).toBe("point-right");
    expect(warn.mock.calls.some((call) => String(call[0]).includes("dance"))).toBe(true);
  });

  it("merges stepDefaults.extensions.avatar with step-level values", async () => {
    const tour = make([{ ...pointing, extensions: { avatar: { dock: "start" } } }], {}, { stepDefaults: { extensions: { avatar: { animation: "boing", dock: "end" } } } });
    await tour.start();
    expect(anim()).toBe("boing");
    expect(wrapper().getAttribute("data-vt-dock")).toBe("start");
  });

  it("starts the step animation only after the engine fade", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const tour = fading([pointing]);
    await tour.start();
    expect(anim()).toBe("rest");
    vi.advanceTimersByTime(399);
    expect(anim()).toBe("rest");
    vi.advanceTimersByTime(1);
    expect(anim()).toBe("point-right");
  });

  it("does not wait for the fade under reduced motion", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    reduced = true;
    const tour = fading([pointing]);
    await tour.start();
    expect(anim()).toBe("point-right");
  });

  it("cancels a pending step animation when the step is left", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const tour = fading([pointing, plain]);
    await tour.start();
    vi.advanceTimersByTime(100);
    await tour.forward();
    vi.advanceTimersByTime(399);
    expect(anim()).toBe("rest");
  });

  it("resolves shown without waiting for the animation", async () => {
    const tour = make([plain]);
    const shown = vi.fn();
    tour.on("step-shown", shown);
    await tour.start();
    expect(shown).toHaveBeenCalledTimes(1);
    expect(frame.callbacks.size).toBeGreaterThan(0);
  });

  it("does not block navigation while an animation plays", async () => {
    const tour = make([plain, pointing]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("t");
  });

  it("re-points when the direction changes after a reposition", async () => {
    const tour = make([pointing]);
    await tour.start();
    expect(anim()).toBe("point-right");
    targetRect = new DOMRect(100, 500, 32, 100);
    tour.refresh();
    await vi.waitFor(() => expect(anim()).toBe("point-down"));
  });

  it("plays nothing for a hidden avatar", async () => {
    const tour = make([{ ...plain, extensions: { avatar: { hidden: true } } }]);
    await tour.start();
    expect(document.querySelector(".vt-avatar")).toBeNull();
  });
});

describe("reactions", () => {
  it("plays alert on nudge then returns to rest", async () => {
    const tour = make([{ ...pointing, instruction: "Click it" }]);
    await tour.start();
    advance(500);
    tour.nudge("Not yet");
    expect(anim()).toBe("boing");
    advance(200);
    await Promise.resolve();
    expect(anim()).toBe("rest");
  });

  it("plays alert when Next is pressed on an unmet action step", async () => {
    const tour = make([{ ...pointing, instruction: "Click it" }, plain]);
    await tour.start();
    advance(500);
    await tour.forward();
    expect(anim()).toBe("boing");
    expect(tour.currentStep?.id).toBe("t");
  });

  it("plays celebrate once on completion, then rest", async () => {
    const tour = make([{ ...pointing, instruction: "Click it", advanceDelay: 5000 }, plain]);
    await tour.start();
    advance(500);
    tour.advance();
    expect(anim()).toBe("cheer");
    advance(50);
    advance(200);
    await Promise.resolve();
    expect(anim()).toBe("rest");
  });

  it("loops think while the wrapper has vt-waiting and stops after", async () => {
    const tour = make([plain, pointing]);
    await tour.start();
    advance(500);
    wrapper().classList.add("vt-waiting");
    await Promise.resolve();
    expect(anim()).toBe("think");
    advance(1000);
    expect(anim()).toBe("think");
    wrapper().classList.remove("vt-waiting");
    await Promise.resolve();
    expect(anim()).toBe("rest");
  });

  it("removes the avatar at once when the tour finishes, without a farewell animation", async () => {
    const tour = make([plain]);
    await tour.start();
    advance(500);
    const finished = tour.finish();
    expect(document.querySelector(".vt-avatar")).toBeNull();
    await finished;
    expect(document.querySelector(".vt-avatar")).toBeNull();
    expect(anim()).toBeUndefined();
  });
});

describe("pack failure", () => {
  it("uses the dialog presenter and calls onError once when the pack rejects", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn();
    const tour = make([plain], { onError }, {}, Promise.reject(new AvatarPackError("sheet.src", "boom")));
    await tour.start();
    expect(wrapper().classList.contains("vt-dialog")).toBe(true);
    expect(wrapper().classList.contains("vt-speaker")).toBe(false);
    expect(document.querySelector(".vt-avatar")).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(AvatarPackError);
    tour.finish();
    await tour.start();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("wraps a plain rejection and warns in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn();
    const tour = make([plain], { onError }, {}, Promise.reject(new Error("offline")));
    await tour.start();
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(AvatarPackError);
    expect(String((onError.mock.calls[0]?.[0] as Error).message)).toContain("offline");
    expect(warn).toHaveBeenCalled();
  });

  it("falls back for an invalid pack object", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn();
    const tour = make([plain], { onError }, {}, { ...definition, format: "nope" } as unknown as AvatarPack);
    await tour.start();
    expect(wrapper().classList.contains("vt-dialog")).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps a throwing onError from breaking the tour", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = make([plain], { onError: () => { throw new Error("x"); } }, {}, Promise.reject(new Error("offline")));
    await expect(tour.start()).resolves.toBeUndefined();
    expect(wrapper().classList.contains("vt-dialog")).toBe(true);
  });

  it("waits for a slow pack and then shows the speaker", async () => {
    let release: (value: AvatarPack) => void = () => {};
    const slow = new Promise<AvatarPack>((resolve) => (release = resolve));
    const tour = make([plain], {}, {}, slow);
    const started = tour.start();
    await Promise.resolve();
    expect(document.querySelector(".vt-popover")).toBeNull();
    release(definition);
    await started;
    expect(wrapper().classList.contains("vt-speaker")).toBe(true);
  });

  it("starts in dialog mode after loadTimeoutMs, reports once, and uses the pack on the next run", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let release: (value: AvatarPack) => void = () => {};
    const slow = new Promise<AvatarPack>((resolve) => (release = resolve));
    const onError = vi.fn();
    const tour = make([plain], { onError, loadTimeoutMs: 200 }, {}, slow);
    const started = tour.start();
    await vi.advanceTimersByTimeAsync(199);
    expect(document.querySelector(".vt-popover")).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await started;
    expect(wrapper().classList.contains("vt-dialog")).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as AvatarPackError).path).toBe("loadTimeoutMs");
    tour.finish();
    release(definition);
    await vi.advanceTimersByTimeAsync(0);
    await tour.start();
    expect(wrapper().classList.contains("vt-speaker")).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("reports once when a timeout is followed by a rejection, and waits only once", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let fail: (reason: unknown) => void = () => {};
    const slow = new Promise<AvatarPack>((_, reject) => (fail = reject));
    const onError = vi.fn();
    const tour = make([plain], { onError, loadTimeoutMs: 200 }, {}, slow);
    const started = tour.start();
    await vi.advanceTimersByTimeAsync(200);
    await started;
    fail(new Error("late"));
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    tour.finish();
    const again = tour.start();
    await vi.advanceTimersByTimeAsync(0);
    await again;
    expect(wrapper().classList.contains("vt-dialog")).toBe(true);
  });

  it("does not show a stale step when the tour restarts while the pack loads", async () => {
    let release: (value: AvatarPack) => void = () => {};
    const slow = new Promise<AvatarPack>((resolve) => (release = resolve));
    const tour = make([{ ...plain, id: "a", title: "A" }], { loadTimeoutMs: 10_000 }, {}, slow);
    const shown = vi.fn();
    tour.on("step-shown", shown);
    void tour.start();
    await Promise.resolve();
    await tour.exit();
    void tour.start();
    await Promise.resolve();
    release(definition);
    await vi.waitFor(() => expect(shown).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(shown).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
  });

  it("resumes the step animation that the think loop deferred", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const tour = fading([pointing]);
    await tour.start();
    wrapper().classList.add("vt-waiting");
    await vi.advanceTimersByTimeAsync(0);
    expect(anim()).toBe("think");
    vi.advanceTimersByTime(1000);
    expect(anim()).toBe("think");
    wrapper().classList.remove("vt-waiting");
    await vi.advanceTimersByTimeAsync(0);
    expect(anim()).toBe("point-right");
  });

  it("does not build the engine when the tour ends while the pack loads", async () => {
    const slow = new Promise<AvatarPack>(() => {});
    const tour = make([plain], { loadTimeoutMs: 10_000 }, {}, slow);
    const started = tour.start();
    await Promise.resolve();
    tour.finish();
    await Promise.race([started, new Promise((resolve) => setTimeout(resolve, 50))]);
    expect(document.querySelector(".vt-popover")).toBeNull();
  });
});
