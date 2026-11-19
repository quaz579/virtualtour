import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribe } from "../../src/dom/frame";

let queue: Map<number, FrameRequestCallback>;
let nextId: number;
let clock: number;
let requested: number;
let cancelled: number;

function flush(advance = 16): void {
  clock += advance;
  const pending = Array.from(queue.values());
  queue.clear();
  for (const callback of pending) callback(clock);
}

beforeEach(() => {
  queue = new Map();
  nextId = 1;
  clock = 1000;
  requested = 0;
  cancelled = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    requested += 1;
    queue.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelled += 1;
    queue.delete(id);
  });
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("frame scheduler", () => {
  it("coalesces 100 subscribers into one rAF per frame", () => {
    const calls = new Array<number>(100).fill(0);
    const offs = calls.map((_, i) => subscribe(() => (calls[i] = (calls[i] ?? 0) + 1)));
    expect(requested).toBe(1);
    flush();
    expect(queue.size).toBe(1);
    expect(requested).toBe(2);
    expect(calls.every((n) => n === 1)).toBe(true);
    flush();
    expect(requested).toBe(3);
    expect(calls.every((n) => n === 2)).toBe(true);
    offs.forEach((off) => off());
  });

  it("passes performance.now() to subscribers", () => {
    const seen: number[] = [];
    const off = subscribe((now) => seen.push(now));
    flush(33);
    expect(seen).toEqual([1033]);
    off();
  });

  it("stops the loop when the last subscriber leaves", () => {
    const a = subscribe(() => undefined);
    const b = subscribe(() => undefined);
    a();
    expect(cancelled).toBe(0);
    expect(queue.size).toBe(1);
    b();
    expect(cancelled).toBe(1);
    expect(queue.size).toBe(0);
    flush();
    expect(requested).toBe(1);
  });

  it("stops after a frame in which the last subscriber unsubscribed itself", () => {
    const off = subscribe(() => off());
    flush();
    expect(queue.size).toBe(0);
    expect(requested).toBe(1);
  });

  it("restarts after going idle and ignores repeated unsubscribes", () => {
    const off = subscribe(() => undefined);
    off();
    off();
    expect(queue.size).toBe(0);
    const again = subscribe(() => undefined);
    expect(queue.size).toBe(1);
    expect(requested).toBe(2);
    again();
  });

  it("does not call a subscriber removed earlier in the same frame, and runs one added mid-frame next frame", () => {
    const order: string[] = [];
    let offB: () => void = () => undefined;
    const offA = subscribe(() => {
      order.push("a");
      offB();
      const offC = subscribe(() => {
        order.push("c");
        offC();
      });
    });
    offB = subscribe(() => order.push("b"));
    flush();
    expect(order).toEqual(["a"]);
    flush();
    expect(order).toEqual(["a", "a", "c"]);
    offA();
  });
});
