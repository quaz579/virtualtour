import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { Tour } from "../../src/index";
import { IdleScheduler } from "../../src/avatar/idle";
import { SpritePlayer } from "../../src/avatar/player";
import { withAvatar } from "../../src/avatar/with-avatar";
import type { AvatarOptions } from "../../src/avatar/speaker";
import { normalizePack, validatePack } from "../../src/avatar/pack";
import type { AvatarPack } from "../../src/avatar/pack";
import { setCurrentTour } from "../../src/registry";
import type { StepConfig } from "../../src/types";

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
    blink: { frames: frames(100) },
    wobble: { frames: frames(100) },
    look: { frames: frames(100) },
    spin: { frames: frames(100), loop: true },
    alarm: { frames: frames(100) },
  },
  roles: { rest: "rest", greet: "wave", alert: "alarm", idle: ["blink", "wobble", "look"] },
};

const pack = (extra: Partial<AvatarPack> = {}) => normalizePack(validatePack({ ...definition, ...extra }), "http://localhost/");

let clock: number;
let reduced: boolean;
const created: Tour[] = [];
const players: SpritePlayer[] = [];

async function run(ms: number): Promise<void> {
  clock += ms;
  await vi.advanceTimersByTimeAsync(ms);
  for (const callback of Array.from(frame.callbacks)) callback(clock);
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  frame.callbacks.clear();
  clock = 0;
  reduced = false;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  for (const player of players.splice(0)) player.dispose();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function scheduler(options: { quietMs?: number; random?: () => number; avatarPack?: ReturnType<typeof pack> } = {}) {
  const avatarPack = options.avatarPack ?? pack();
  const el = document.createElement("div");
  document.body.append(el);
  const player = new SpritePlayer(avatarPack, el, { reducedMotion: () => reduced });
  players.push(player);
  const idle = new IdleScheduler(player, avatarPack, { quietMs: options.quietMs ?? 300, reducedMotion: () => reduced, ...(options.random ? { random: options.random } : {}) });
  return { idle, player, name: () => el.getAttribute("data-vt-anim") };
}

describe("IdleScheduler", () => {
  it("plays an idle animation only after the quiet period", async () => {
    const { idle, name } = scheduler();
    idle.arm();
    await run(299);
    expect(name()).toBe("rest");
    await run(1);
    expect(["blink", "wobble", "look"]).toContain(name());
  });

  it("returns to rest after the animation and waits a full quiet period again", async () => {
    const { idle, name } = scheduler();
    idle.arm();
    await run(300);
    expect(name()).not.toBe("rest");
    await run(100);
    expect(name()).toBe("rest");
    await run(299);
    expect(name()).toBe("rest");
    await run(1);
    expect(name()).not.toBe("rest");
  });

  it("never picks the same idle animation twice in a row", async () => {
    const { idle, name } = scheduler({ quietMs: 10, random: () => 0 });
    idle.arm();
    const seen: (string | null)[] = [];
    for (let i = 0; i < 6; i += 1) {
      await run(10);
      seen.push(name());
      await run(100);
    }
    expect(seen.every((n) => n !== "rest" && n !== null)).toBe(true);
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it("plays a single idle animation repeatedly when it is the only one", async () => {
    const { idle, name } = scheduler({ quietMs: 10, avatarPack: pack({ roles: { rest: "rest", idle: "blink" } }) });
    idle.arm();
    for (let i = 0; i < 3; i += 1) {
      await run(10);
      expect(name()).toBe("blink");
      await run(100);
      expect(name()).toBe("rest");
    }
  });

  it("does not loop an idle animation the pack marks as looping", async () => {
    const { idle, name } = scheduler({ quietMs: 10, avatarPack: pack({ roles: { rest: "rest", idle: "spin" } }) });
    idle.arm();
    await run(10);
    expect(name()).toBe("spin");
    await run(100);
    expect(name()).toBe("rest");
  });

  it("disarm cancels the pending quiet period", async () => {
    const { idle, name } = scheduler();
    idle.arm();
    await run(200);
    idle.disarm();
    await run(1000);
    expect(name()).toBe("rest");
  });

  it("disarm during playback stops it from re-arming", async () => {
    const { idle, player, name } = scheduler();
    idle.arm();
    await run(300);
    idle.disarm();
    player.stop();
    await run(2000);
    expect(name()).toBe("rest");
  });

  it("arming again restarts the quiet period", async () => {
    const { idle, name } = scheduler();
    idle.arm();
    await run(200);
    idle.arm();
    await run(200);
    expect(name()).toBe("rest");
    await run(100);
    expect(name()).not.toBe("rest");
  });

  it("never arms under reduced motion", async () => {
    reduced = true;
    const { idle, name } = scheduler();
    idle.arm();
    await run(5000);
    expect(name()).toBe("rest");
  });

  it("does not fire when reduced motion turns on during the quiet period", async () => {
    const { idle, name } = scheduler();
    idle.arm();
    await run(100);
    reduced = true;
    await run(500);
    expect(name()).toBe("rest");
  });

  it("never arms for a pack with no idle role", async () => {
    const { idle, name } = scheduler({ avatarPack: pack({ roles: { rest: "rest" } }) });
    idle.arm();
    await run(5000);
    expect(name()).toBe("rest");
  });

  it("defaults to a six second quiet period", async () => {
    const avatarPack = pack();
    const el = document.createElement("div");
    const player = new SpritePlayer(avatarPack, el, { reducedMotion: () => false });
    players.push(player);
    const idle = new IdleScheduler(player, avatarPack, { reducedMotion: () => false });
    idle.arm();
    await run(5999);
    expect(el.getAttribute("data-vt-anim")).toBe("rest");
    await run(1);
    expect(el.getAttribute("data-vt-anim")).not.toBe("rest");
  });
});

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover");
const anim = () => document.querySelector<HTMLElement>(".vt-avatar")?.getAttribute("data-vt-anim");
const plain: StepConfig = { id: "p", title: "Plain", body: "No target" };
const restStep = (id: string, avatar: Record<string, unknown> = {}, extra: Partial<StepConfig> = {}): StepConfig => ({
  id,
  title: id,
  body: id,
  extensions: { avatar: { animation: "rest", ...avatar } },
  ...extra,
});
const second: StepConfig = { id: "q", title: "Second", body: "Next" };
const IDLE = ["blink", "wobble", "look"];

function make(steps: StepConfig[], options: AvatarOptions = {}, avatarPack = pack()): Tour {
  const tour = createTour({ animate: false, steps, presenter: withAvatar(avatarPack, options) });
  created.push(tour);
  return tour;
}

describe("idle loop in the avatar presenter", () => {
  it("does not interrupt the step animation, and arms only after it ends", async () => {
    const tour = make([plain], { idleQuietMs: 50 });
    await tour.start();
    expect(anim()).toBe("wave");
    await run(60);
    expect(anim()).toBe("wave");
    await run(50);
    expect(anim()).toBe("wave");
    await run(50);
    expect(IDLE).toContain(anim());
    await run(100);
    expect(anim()).toBe("rest");
  });

  it("plays idle animations after the quiet period and returns to rest", async () => {
    const tour = make([plain, second], { idleQuietMs: 300 });
    await tour.start();
    await tour.forward();
    expect(anim()).toBe("rest");
    await run(299);
    expect(anim()).toBe("rest");
    await run(1);
    expect(IDLE).toContain(anim());
    await run(100);
    expect(anim()).toBe("rest");
  });

  it("is disarmed when the step is left", async () => {
    const tour = make([plain, second], { idleQuietMs: 300 });
    await tour.start();
    await tour.forward();
    await run(200);
    await tour.backward();
    expect(anim()).toBe("wave");
    await run(150);
    expect(anim()).toBe("wave");
  });

  it("is disarmed when the tour ends", async () => {
    const tour = make([restStep("q")], { idleQuietMs: 300 });
    await tour.start();
    await run(200);
    tour.finish();
    const play = vi.spyOn(SpritePlayer.prototype, "play");
    await run(2000);
    expect(play).not.toHaveBeenCalled();
  });

  it("is off when idle is false", async () => {
    const tour = make([restStep("q")], { idleQuietMs: 50, idle: false });
    await tour.start();
    await run(1000);
    expect(anim()).toBe("rest");
  });

  it("is off for a step with idle false, and back on for the next", async () => {
    const tour = make([restStep("q", { idle: false }), restStep("r")], { idleQuietMs: 50 });
    await tour.start();
    await run(1000);
    expect(anim()).toBe("rest");
    await tour.forward();
    await run(50);
    expect(IDLE).toContain(anim());
  });

  it("is on for a step with idle true when the tour turns it off", async () => {
    const tour = make([restStep("q", { idle: true })], { idleQuietMs: 50, idle: false });
    await tour.start();
    await run(50);
    expect(IDLE).toContain(anim());
  });

  it("stays off for a hidden step", async () => {
    const tour = make([restStep("q", { hidden: true })], { idleQuietMs: 50 });
    const play = vi.spyOn(SpritePlayer.prototype, "play");
    await tour.start();
    await run(1000);
    expect(play).not.toHaveBeenCalled();
  });

  it("never arms under reduced motion", async () => {
    reduced = true;
    const tour = make([restStep("q"), restStep("r")], { idleQuietMs: 50 });
    await tour.start();
    await run(1000);
    expect(anim()).toBe("rest");
    await tour.forward();
    await run(1000);
    expect(anim()).toBe("rest");
    expect(wrapper()).not.toBeNull();
  });

  it("does not play idle on top of a reaction, and re-arms after it", async () => {
    const tour = make([restStep("q", {}, { instruction: "Do it" })], { idleQuietMs: 50 });
    await tour.start();
    await run(50);
    expect(IDLE).toContain(anim());
    tour.nudge();
    expect(anim()).toBe("alarm");
    await run(60);
    expect(anim()).toBe("alarm");
    await run(50);
    expect(anim()).toBe("rest");
    await run(50);
    expect(IDLE).toContain(anim());
  });
});
