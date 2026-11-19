import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { Tour } from "../../src/index";
import { withAvatar } from "../../src/avatar/with-avatar";
import type { AvatarOptions } from "../../src/avatar/speaker";
import { normalizePack, validatePack } from "../../src/avatar/pack";
import type { AvatarPack, AvatarPackError } from "../../src/avatar/pack";
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
    think: { frames: frames(100), loop: true },
  },
  roles: { rest: "rest", greet: "wave", think: "think" },
};

type Outcome = "load" | "error" | "hang";

let outcome: Outcome;
let requested: string[];
let released: string[];
const created: Tour[] = [];

const plain = (id: string): StepConfig => ({ id, title: id, body: "Body" });
const wrapper = () => document.querySelector<HTMLElement>(".vt-popover") as HTMLElement;
const anim = () => document.querySelector<HTMLElement>(".vt-avatar")?.getAttribute("data-vt-anim");

function make(steps: StepConfig[], options: AvatarOptions = {}, source: AvatarPack | Promise<AvatarPack> = definition): Tour {
  const tour = createTour({ animate: false, steps, presenter: withAvatar(source, options) });
  created.push(tour);
  return tour;
}

beforeEach(() => {
  frame.callbacks.clear();
  outcome = "load";
  requested = [];
  released = [];
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private url = "";
      set src(value: string) {
        if (value === "") {
          released.push(this.url);
          return;
        }
        this.url = value;
        requested.push(value);
        if (outcome === "load") queueMicrotask(() => this.onload?.());
        if (outcome === "error") queueMicrotask(() => this.onerror?.());
      }
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  Element.prototype.scrollIntoView = vi.fn();
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

describe("sheet preload", () => {
  it("preloads the sheet of a raw pack before the first step and shows the speaker", async () => {
    const tour = make([plain("a")]);
    await tour.start();
    expect(requested).toEqual([new URL("sheet.png", document.baseURI).href]);
    expect(wrapper().classList.contains("vt-speaker")).toBe(true);
  });

  it("does not preload again for a pack that is already normalized", async () => {
    const tour = make([plain("a")], {}, normalizePack(validatePack(definition), "http://localhost/") as never);
    await tour.start();
    expect(requested).toEqual([]);
    expect(wrapper().classList.contains("vt-speaker")).toBe(true);
  });

  it("falls back to a dialog and reports once when the sheet 404s", async () => {
    outcome = "error";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn();
    const tour = make([plain("a"), plain("b")], { onError });
    await tour.start();
    await tour.forward();
    expect(wrapper().classList.contains("vt-dialog")).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as AvatarPackError).path).toBe("sheet.src");
  });

  it("warns once in dev and logs no error when the sheet 404s", async () => {
    outcome = "error";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = make([plain("a")]);
    await tour.start();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it("gives up on a sheet that never loads after loadTimeoutMs and releases the request", async () => {
    outcome = "hang";
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn();
    const tour = make([plain("a")], { onError, loadTimeoutMs: 300 });
    const started = tour.start();
    await vi.advanceTimersByTimeAsync(299);
    expect(document.querySelector(".vt-popover")).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await started;
    expect(wrapper().classList.contains("vt-dialog")).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(released).toEqual([requested[0]]);
  });
});

describe("late pack", () => {
  it("keeps the current run as a dialog and uses the pack on the next run", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let release: (value: AvatarPack) => void = () => {};
    const slow = new Promise<AvatarPack>((resolve) => (release = resolve));
    const tour = make([plain("a"), plain("b")], { loadTimeoutMs: 100 }, slow);
    const started = tour.start();
    await vi.advanceTimersByTimeAsync(100);
    await started;
    release(definition);
    await vi.advanceTimersByTimeAsync(0);
    await tour.forward();
    expect(wrapper().classList.contains("vt-dialog")).toBe(true);
    tour.finish();
    await tour.start();
    expect(wrapper().classList.contains("vt-speaker")).toBe(true);
  });
});

describe("a presenter whose run ended before the pack arrived", () => {
  it("never builds a speaker presenter after unmount", async () => {
    let release: (value: AvatarPack) => void = () => {};
    const slow = new Promise<AvatarPack>((resolve) => (release = resolve));
    const tour = createTour({ steps: [plain("a")] });
    const presenter = withAvatar(slow)(tour, { namespace: "vt", fadeMs: 0 });
    const ready = presenter.ready?.();
    presenter.unmount();
    release(definition);
    await ready;
    expect(presenter.layout).toBe("dialog");
  });
});

describe("avatar.css check", () => {
  it("warns once in dev when the avatar stylesheet marker is missing", async () => {
    document.head.querySelectorAll("style").forEach((style) => style.remove());
    const style = document.createElement("style");
    style.textContent = ".vt-popover { --vt-base: 1; }";
    document.head.append(style);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = make([plain("a"), plain("b")]);
    await tour.start();
    await tour.forward();
    const messages = warn.mock.calls.map((call) => String(call[0])).filter((text) => text.includes("avatar.css"));
    expect(messages).toHaveLength(1);
    style.textContent = ".vt-popover { --vt-base: 1; } .vt-speaker { --vt-avatar-base: 1; }";
  });

  it("stays quiet when the marker is present", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = make([plain("a")]);
    await tour.start();
    expect(warn.mock.calls.filter((call) => String(call[0]).includes("avatar.css"))).toEqual([]);
  });
});

describe("greeting", () => {
  it("greets the first step that is shown even when earlier steps were skipped", async () => {
    const tour = make([{ ...plain("skipped"), shouldShow: () => false }, plain("b"), plain("c")]);
    await tour.start();
    expect(anim()).toBe("wave");
  });

  it("does not greet a later step reached with goTo, and greets the opening step again", async () => {
    const tour = make([plain("a"), plain("b"), plain("c")]);
    await tour.start();
    expect(anim()).toBe("wave");
    await tour.goTo(2);
    expect(anim()).toBe("rest");
    await tour.goTo(0);
    expect(anim()).toBe("wave");
  });
});
