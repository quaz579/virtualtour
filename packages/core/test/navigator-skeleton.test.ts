import { describe, expect, it } from "vitest";
import { NavigationQueue, resolveStepIndex, selectEligible } from "../src/navigator";
import { TourNavigationError } from "../src/errors";
import { createTour } from "../src/index";

const selectIndex = (total: number, from: number, direction: "forward" | "backward", isEligible: (index: number) => boolean = () => true) =>
  selectEligible(total, from, direction, isEligible);

describe("selectEligible", () => {
  it("moves forward to the next index", () => {
    expect(selectIndex(3, -1, "forward")).toEqual({ kind: "show", index: 0 });
    expect(selectIndex(3, 0, "forward")).toEqual({ kind: "show", index: 1 });
  });

  it("finishes when moving forward past the last step", () => {
    expect(selectIndex(3, 2, "forward")).toEqual({ kind: "finish" });
    expect(selectIndex(0, -1, "forward")).toEqual({ kind: "finish" });
  });

  it("moves backward to the previous index", () => {
    expect(selectIndex(3, 2, "backward")).toEqual({ kind: "show", index: 1 });
  });

  it("stays put when moving backward from the first step or before the first show", () => {
    expect(selectIndex(3, 0, "backward")).toEqual({ kind: "stay" });
    expect(selectIndex(3, -1, "backward")).toEqual({ kind: "stay" });
  });

  it("skips ineligible indexes in either direction", () => {
    const only = (...ok: number[]) => (i: number) => ok.includes(i);
    expect(selectIndex(5, 0, "forward", only(3))).toEqual({ kind: "show", index: 3 });
    expect(selectIndex(5, 4, "backward", only(1))).toEqual({ kind: "show", index: 1 });
  });

  it("finishes forward and exits backward when nothing is eligible", () => {
    expect(selectIndex(4, 1, "forward", () => false)).toEqual({ kind: "finish" });
    expect(selectIndex(4, 2, "backward", () => false)).toEqual({ kind: "exit" });
  });
});

describe("resolveStepIndex", () => {
  const tour = createTour({ steps: [{ id: "a" }, { id: "b" }] });

  it("resolves an index, an id and an instance", () => {
    expect(resolveStepIndex(tour.steps, 1)).toBe(1);
    expect(resolveStepIndex(tour.steps, "b")).toBe(1);
    expect(resolveStepIndex(tour.steps, tour.steps[0]!)).toBe(0);
  });

  it.each([-1, 2, 0.5, "nope"])("throws for %j", (ref) => {
    expect(() => resolveStepIndex(tour.steps, ref)).toThrow(TourNavigationError);
  });

  it("throws for a step of another tour", () => {
    const other = createTour({ steps: [{ id: "a" }] });
    expect(() => resolveStepIndex(tour.steps, other.steps[0]!)).toThrow(TourNavigationError);
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("NavigationQueue", () => {
  it("runs a task at once when idle", async () => {
    const q = new NavigationQueue();
    const log: string[] = [];
    const done = q.enqueue(async () => {
      log.push("ran");
    });
    expect(q.busy).toBe(true);
    expect(log).toEqual(["ran"]);
    await done;
    expect(q.busy).toBe(false);
  });

  it("queues a task behind a running one and runs it after", async () => {
    const q = new NavigationQueue();
    const log: string[] = [];
    const gate = deferred();
    const first = q.enqueue(async () => {
      log.push("first:start");
      await gate.promise;
      log.push("first:end");
    });
    const second = q.enqueue(async () => {
      log.push("second");
    });
    expect(log).toEqual(["first:start"]);
    gate.resolve();
    await Promise.all([first, second]);
    expect(log).toEqual(["first:start", "first:end", "second"]);
  });

  it("keeps one waiting task: a newer request replaces an older queued one", async () => {
    const q = new NavigationQueue();
    const log: string[] = [];
    const gate = deferred();
    const first = q.enqueue(() => gate.promise);
    const b = q.enqueue(async () => {
      log.push("b");
    });
    const c = q.enqueue(async () => {
      log.push("c");
    });
    gate.resolve();
    await Promise.all([first, b, c]);
    expect(log).toEqual(["c"]);
  });

  it("resolves a replaced caller only after the task that replaced it settled", async () => {
    const q = new NavigationQueue();
    const log: string[] = [];
    const gate = deferred();
    const slow = deferred();
    const first = q.enqueue(() => gate.promise);
    const b = q.enqueue(async () => {
      log.push("b");
    });
    const c = q.enqueue(async () => {
      log.push("c:start");
      await slow.promise;
      log.push("c:end");
    });
    void b.then(() => log.push("b settled"));
    void c.then(() => log.push("c settled"));
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual([]);
    gate.resolve();
    await first;
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(["c:start"]);
    slow.resolve();
    await Promise.all([b, c]);
    expect(log).toEqual(["c:start", "c:end", "c settled", "b settled"]);
  });

  it("does not reject a replaced caller when the replacing task throws", async () => {
    const q = new NavigationQueue();
    const gate = deferred();
    const first = q.enqueue(() => gate.promise);
    const b = q.enqueue(async () => undefined);
    const c = q.enqueue(async () => {
      throw new Error("boom");
    });
    const cOutcome = c.then(
      () => "resolved",
      () => "rejected"
    );
    gate.resolve();
    await first;
    await expect(b).resolves.toBeUndefined();
    expect(await cOutcome).toBe("rejected");
  });

  it("resolves a waiting task and its replaced callers at once when cancelled", async () => {
    const q = new NavigationQueue();
    const log: string[] = [];
    const gate = deferred();
    const first = q.enqueue(() => gate.promise);
    const b = q.enqueue(async () => {
      log.push("b");
    });
    const c = q.enqueue(async () => {
      log.push("c");
    });
    q.cancelWaiting();
    await Promise.all([b, c]);
    gate.resolve();
    await first;
    expect(log).toEqual([]);
  });

  it("rejects the caller's promise when its task throws and keeps serving the queue", async () => {
    const q = new NavigationQueue();
    const gate = deferred();
    const failing = q.enqueue(async () => {
      await gate.promise;
      throw new Error("boom");
    });
    const log: string[] = [];
    const next = q.enqueue(async () => {
      log.push("next");
    });
    gate.resolve();
    await expect(failing).rejects.toThrow("boom");
    await next;
    expect(log).toEqual(["next"]);
    expect(q.busy).toBe(false);
  });

  it("cancelWaiting resolves the waiting task without running it", async () => {
    const q = new NavigationQueue();
    const gate = deferred();
    const first = q.enqueue(() => gate.promise);
    let ran = false;
    const waiting = q.enqueue(async () => {
      ran = true;
    });
    q.cancelWaiting();
    await waiting;
    gate.resolve();
    await first;
    expect(ran).toBe(false);
  });

  it("accepts new work after going idle", async () => {
    const q = new NavigationQueue();
    await q.enqueue(async () => undefined);
    const log: string[] = [];
    await q.enqueue(async () => {
      log.push("again");
    });
    expect(log).toEqual(["again"]);
  });
});
