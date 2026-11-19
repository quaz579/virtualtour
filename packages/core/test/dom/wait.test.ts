import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTarget, waitForTarget } from "../../src/dom/target";

const FAKES = ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame"] as const;

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function add(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

describe("resolveTarget", () => {
  it("finds a selector, a connected element and a function result", () => {
    const el = add("a");
    expect(resolveTarget("#a")).toBe(el);
    expect(resolveTarget(el)).toBe(el);
    expect(resolveTarget(() => "#a")).toBe(el);
    expect(resolveTarget(() => el)).toBe(el);
  });

  it("returns null for undefined, a missing selector, a detached element and a null result", () => {
    const detached = document.createElement("div");
    expect(resolveTarget(undefined)).toBeNull();
    expect(resolveTarget("#nope")).toBeNull();
    expect(resolveTarget(detached)).toBeNull();
    expect(resolveTarget(() => null)).toBeNull();
    expect(resolveTarget(() => undefined)).toBeNull();
  });

  it("treats an invalid selector and a throwing function as missing", () => {
    expect(resolveTarget("###")).toBeNull();
    expect(
      resolveTarget(() => {
        throw new Error("boom");
      })
    ).toBeNull();
  });
});

describe("waitForTarget", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [...FAKES] });
  });

  it("resolves at once when the target exists", async () => {
    const el = add("a");
    await expect(waitForTarget("#a", 1000)).resolves.toBe(el);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves null at once for a zero wait", async () => {
    await expect(waitForTarget("#a", 0)).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves through the mutation observer within a frame", async () => {
    const pending = waitForTarget("#late", 3000);
    const el = add("late");
    await vi.advanceTimersByTimeAsync(20);
    await expect(pending).resolves.toBe(el);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves through the poll when the observer never fires", async () => {
    class SilentObserver {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("MutationObserver", SilentObserver);
    const pending = waitForTarget("#late", 3000);
    const el = add("late");
    await vi.advanceTimersByTimeAsync(249);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe(el);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("checks at most once per frame however many mutation batches arrive", async () => {
    const spy = vi.fn(() => null);
    const pending = waitForTarget(spy, 500);
    spy.mockClear();
    for (let i = 0; i < 5; i += 1) {
      add(`n${i}`);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(16);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    await pending;
  });

  it("cancels a scheduled frame when it settles", async () => {
    const spy = vi.fn(() => null);
    const controller = new AbortController();
    const pending = waitForTarget(spy, 5000, controller.signal);
    add("n");
    await vi.advanceTimersByTimeAsync(0);
    spy.mockClear();
    controller.abort();
    await pending;
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(50);
    expect(spy).not.toHaveBeenCalled();
  });

  it("resolves null after the timeout and leaves no timers", async () => {
    const pending = waitForTarget("#never", 500);
    await vi.advanceTimersByTimeAsync(499);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts with no timers left", async () => {
    const controller = new AbortController();
    const pending = waitForTarget("#never", 5000, controller.signal);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    controller.abort();
    await expect(pending).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves null at once for an already aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(waitForTarget("#never", 5000, controller.signal)).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("caps the timeout at the largest delay setTimeout accepts", async () => {
    const delays: number[] = [];
    const real = globalThis.setTimeout;
    const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
      delays.push(ms ?? 0);
      return real(fn, 0);
    }) as typeof setTimeout);
    const controller = new AbortController();
    const pending = waitForTarget("#never", Infinity, controller.signal);
    controller.abort();
    await pending;
    spy.mockRestore();
    expect(delays).toContain(2 ** 31 - 1);
    expect(delays.every((d) => d <= 2 ** 31 - 1)).toBe(true);
  });

  it("disconnects the observer when it settles", async () => {
    const disconnect = vi.fn();
    class CountingObserver {
      observe(): void {}
      disconnect = disconnect;
    }
    vi.stubGlobal("MutationObserver", CountingObserver);
    const pending = waitForTarget("#never", 100);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
