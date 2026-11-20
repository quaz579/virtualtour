import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour, localStorageStore, memoryStore, tours } from "../src/index";
import type { ProgressRecord, ProgressStore, Tour, TourConfig } from "../src/index";
import { setCurrentTour } from "../src/registry";

const created: Tour[] = [];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function make(config: TourConfig = {}): Tour {
  const tour = createTour({
    id: "intro",
    animate: false,
    steps: ["a", "b", "c"].map((id) => ({ id, title: id, body: id })),
    ...config,
  });
  created.push(tour);
  return tour;
}

function watch(tour: Tour): string[] {
  const log: string[] = [];
  tour.on("started", () => log.push("started"));
  tour.on("bypassed", (p) => log.push(`bypassed:${p.reason}`));
  tour.on("step-shown", (p) => log.push(`shown:${p.step.id}`));
  tour.on("finished", () => log.push("finished"));
  tour.on("exited", (p) => log.push(`exited:${p.reason}`));
  return log;
}

const recordOf = (store: ProgressStore, id = "intro"): ProgressRecord | null => store.load(id) as ProgressRecord | null;

describe("memoryStore", () => {
  it("round-trips, copies records and clears", () => {
    const store = memoryStore();
    expect(store.load("x")).toBeNull();
    const record: ProgressRecord = { tourId: "x", lastStepId: "b", updatedAt: "2026-01-01T00:00:00.000Z" };
    store.save(record);
    const loaded = store.load("x") as ProgressRecord;
    expect(loaded).toEqual(record);
    expect(loaded).not.toBe(record);
    loaded.lastStepId = "changed";
    expect(recordOf(store, "x")?.lastStepId).toBe("b");
    store.clear("x");
    expect(store.load("x")).toBeNull();
  });
});

describe("localStorageStore", () => {
  const record: ProgressRecord = { tourId: "billing", lastStepId: "save", completedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };

  it("uses the key <prefix>:<tourId> with a JSON value", () => {
    const store = localStorageStore();
    store.save(record);
    expect(JSON.parse(localStorage.getItem("virtualtour:billing") as string)).toEqual(record);
    expect(store.load("billing")).toEqual(record);
    store.clear("billing");
    expect(localStorage.getItem("virtualtour:billing")).toBeNull();
  });

  it("honors a custom prefix", () => {
    localStorageStore("app").save(record);
    expect(localStorage.getItem("app:billing")).not.toBeNull();
    expect(localStorageStore().load("billing")).toBeNull();
  });

  it.each(["{not json", "null", "[]", '"text"', "7", JSON.stringify({ tourId: "other", updatedAt: "x" }), JSON.stringify({ tourId: "billing" })])(
    "treats %s as no record",
    (raw) => {
      localStorage.setItem("virtualtour:billing", raw);
      expect(localStorageStore().load("billing")).toBeNull();
    }
  );

  it("overwrites a corrupt value on the next save", () => {
    localStorage.setItem("virtualtour:billing", "{corrupt");
    const store = localStorageStore();
    store.save(record);
    expect(store.load("billing")).toEqual(record);
  });

  it("drops fields of the wrong type", () => {
    localStorage.setItem("virtualtour:billing", JSON.stringify({ tourId: "billing", updatedAt: "u", lastStepId: 4, completedAt: {} }));
    expect(localStorageStore().load("billing")).toEqual({ tourId: "billing", updatedAt: "u" });
  });

  it("catches a quota error on save and any error on clear", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const store = localStorageStore();
    expect(() => store.save(record)).not.toThrow();
    expect(() => store.clear("billing")).not.toThrow();
  });

  it("returns null when reading throws or storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(localStorageStore().load("billing")).toBeNull();
    vi.restoreAllMocks();
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const store = localStorageStore();
    expect(store.load("billing")).toBeNull();
    expect(() => store.save(record)).not.toThrow();
  });

  it("touches no storage until a method is called", () => {
    const getter = vi.spyOn(window, "localStorage", "get");
    localStorageStore("later");
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("tour progress", () => {
  it("saves lastStepId on every step-shown", async () => {
    const store = memoryStore();
    const tour = make({ progress: { store } });
    await tour.start();
    expect(recordOf(store)).toMatchObject({ tourId: "intro", lastStepId: "a" });
    await tour.forward();
    expect(recordOf(store)).toMatchObject({ lastStepId: "b" });
    expect(recordOf(store)?.completedAt).toBeUndefined();
  });

  it("marks completion on finish and keeps no lastStepId", async () => {
    const store = memoryStore();
    const tour = make({ progress: { store } });
    await tour.start();
    tour.finish();
    const saved = recordOf(store) as ProgressRecord;
    expect(Number.isNaN(Date.parse(saved.completedAt as string))).toBe(false);
    expect(saved.lastStepId).toBeUndefined();
    expect(saved.exitedAt).toBeUndefined();
  });

  it("saves exitedAt and lastStepId on exit", async () => {
    const store = memoryStore();
    const tour = make({ progress: { store } });
    await tour.start();
    await tour.forward();
    await tour.exit();
    const saved = recordOf(store) as ProgressRecord;
    expect(saved.lastStepId).toBe("b");
    expect(Number.isNaN(Date.parse(saved.exitedAt as string))).toBe(false);
    expect(saved.completedAt).toBeUndefined();
  });

  it("does not save exitedAt when another tour replaces it", async () => {
    const store = memoryStore();
    const first = make({ progress: { store } });
    const second = make({ id: "other" });
    await first.start();
    await second.start();
    const saved = recordOf(store) as ProgressRecord;
    expect(saved.lastStepId).toBe("a");
    expect(saved.exitedAt).toBeUndefined();
  });

  it("skips a completed tour: bypassed, no started, no popover", async () => {
    const store = memoryStore();
    store.save({ tourId: "intro", completedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
    const tour = make({ progress: { store } });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["bypassed:completed"]);
    expect(tour.isRunning()).toBe(false);
    expect(document.querySelector(".vt-popover")).toBeNull();
  });

  it("relays bypassed through the registry", async () => {
    const store = memoryStore();
    store.save({ tourId: "intro", completedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
    const seen: string[] = [];
    tours.on("bypassed", (p) => seen.push(p.tour.id));
    await make({ progress: { store } }).start();
    expect(seen).toEqual(["intro"]);
  });

  it("runs a completed tour again when skipCompleted is false and keeps completedAt", async () => {
    const store = memoryStore();
    const completedAt = "2026-01-01T00:00:00.000Z";
    store.save({ tourId: "intro", completedAt, updatedAt: completedAt });
    const tour = make({ progress: { store, skipCompleted: false } });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["started", "shown:a"]);
    expect(recordOf(store)).toMatchObject({ lastStepId: "a", completedAt });
  });

  it("starts at the first step by default even with a saved step", async () => {
    const store = memoryStore();
    store.save({ tourId: "intro", lastStepId: "c", exitedAt: "x", updatedAt: "x" });
    const tour = make({ progress: { store } });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["started", "shown:a"]);
  });

  it("resumes at the saved step: the first step-shown is that step", async () => {
    const store = memoryStore();
    store.save({ tourId: "intro", lastStepId: "b", exitedAt: "x", updatedAt: "x" });
    const tour = make({ progress: { store, resume: true } });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["started", "shown:b"]);
    expect(recordOf(store)?.exitedAt).toBeUndefined();
  });

  it("resumes at the first step when the saved step no longer exists", async () => {
    const store = memoryStore();
    store.save({ tourId: "intro", lastStepId: "gone", updatedAt: "x" });
    const tour = make({ progress: { store, resume: true } });
    const log = watch(tour);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await tour.start();
    expect(log).toEqual(["started", "shown:a"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Saved step "gone" is not in tour "intro"'));
  });

  it("does not warn about a missing saved step when resume is off", async () => {
    const store = memoryStore();
    store.save({ tourId: "intro", lastStepId: "gone", updatedAt: "x" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await make({ progress: { store } }).start();
    expect(warn).not.toHaveBeenCalled();
  });

  it("resumes through eligibility: an ineligible saved step moves on", async () => {
    const store = memoryStore();
    store.save({ tourId: "intro", lastStepId: "b", updatedAt: "x" });
    const tour = make({
      progress: { store, resume: true },
      steps: [
        { id: "a", title: "a", body: "a" },
        { id: "b", title: "b", body: "b", shouldShow: () => false },
        { id: "c", title: "c", body: "c" },
      ],
    });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["started", "shown:c"]);
  });

  it("resumes after a completed run only from a later exit", async () => {
    const store = memoryStore();
    const completedAt = "2026-01-01T00:00:00.000Z";
    store.save({ tourId: "intro", completedAt, updatedAt: completedAt });
    const tour = make({ progress: { store, skipCompleted: false, resume: true } });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["started", "shown:a"]);
    await tour.forward();
    await tour.exit();
    const again = make({ progress: { store, skipCompleted: false, resume: true } });
    const log2 = watch(again);
    await again.start();
    expect(log2).toEqual(["started", "shown:b"]);
  });

  it("round-trips through localStorage across tour instances", async () => {
    const first = make({ progress: { store: localStorageStore() } });
    await first.start();
    await first.forward();
    await first.exit();
    const second = make({ progress: { store: localStorageStore(), resume: true } });
    const log = watch(second);
    await second.start();
    expect(log).toEqual(["started", "shown:b"]);
    second.finish();
    const third = make({ progress: { store: localStorageStore() } });
    const log3 = watch(third);
    await third.start();
    expect(log3).toEqual(["bypassed:completed"]);
  });

  it("starts from step 1 after store.clear", async () => {
    const store = memoryStore();
    const first = make({ progress: { store } });
    await first.start();
    first.finish();
    await store.clear("intro");
    const second = make({ progress: { store } });
    const log = watch(second);
    await second.start();
    expect(log).toEqual(["started", "shown:a"]);
  });

  it("awaits an async store.load", async () => {
    const record: ProgressRecord = { tourId: "intro", completedAt: "x", updatedAt: "x" };
    const store: ProgressStore = {
      load: () => new Promise((resolve) => setTimeout(() => resolve(record), 20)),
      save: () => {},
      clear: () => {},
    };
    const tour = make({ progress: { store } });
    const log = watch(tour);
    const pending = tour.start();
    expect(log).toEqual([]);
    await pending;
    expect(log).toEqual(["bypassed:completed"]);
  });

  it("stops waiting for a load that never settles and starts fresh", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store: ProgressStore = { load: () => new Promise(() => {}), save: () => {}, clear: () => {} };
    const tour = make({ progress: { store }, waitBudget: 40 });
    const log = watch(tour);
    const pending = tour.start();
    expect(log).toEqual([]);
    await pending;
    expect(log).toEqual(["started", "shown:a"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("did not settle within 40 ms"));
  });

  it("ignores a load that resolves after the timeout", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let late: (record: ProgressRecord) => void = () => {};
    const store: ProgressStore = { load: () => new Promise((resolve) => (late = resolve)), save: () => {}, clear: () => {} };
    const tour = make({ progress: { store, resume: true }, waitBudget: 30 });
    const log = watch(tour);
    await tour.start();
    late({ tourId: "intro", lastStepId: "c", completedAt: "x", updatedAt: "x" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(log).toEqual(["started", "shown:a"]);
    expect(tour.progressInfo().index).toBe(1);
  });

  it("a rejecting load after the timeout is not an unhandled rejection", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown): void => void seen.push(reason);
    process.on("unhandledRejection", onUnhandled);
    let fail: (error: Error) => void = () => {};
    const store: ProgressStore = { load: () => new Promise((_resolve, reject) => (fail = reject)), save: () => {}, clear: () => {} };
    await make({ progress: { store }, waitBudget: 20 }).start();
    fail(new Error("late"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off("unhandledRejection", onUnhandled);
    expect(seen).toEqual([]);
  });

  it("a load that settles in time leaves no timer to warn later", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = make({ progress: { store: memoryStore() }, waitBudget: 30 });
    await tour.start();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(warn).not.toHaveBeenCalled();
  });

  it("a late completedAt is kept in later saves", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let late: (record: ProgressRecord) => void = () => {};
    const saved: ProgressRecord[] = [];
    const store: ProgressStore = { load: () => new Promise((resolve) => (late = resolve)), save: (r) => void saved.push(r), clear: () => {} };
    const tour = make({ progress: { store }, waitBudget: 30 });
    await tour.start();
    late({ tourId: "intro", completedAt: "done", updatedAt: "x" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(saved.at(-1)?.completedAt).toBe("done");
    tour.forward();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saved.at(-1)).toMatchObject({ lastStepId: "b", completedAt: "done" });
  });

  it("a save that never settles does not block a later start past waitBudget", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store: ProgressStore = { load: () => null, save: () => new Promise(() => {}), clear: () => {} };
    const tour = make({ progress: { store }, waitBudget: 30 });
    await tour.start();
    tour.exit();
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["started", "shown:a"]);
  });

  it("waitBudget 0 keeps waiting for a slow load", async () => {
    const store: ProgressStore = {
      load: () => new Promise((resolve) => setTimeout(() => resolve({ tourId: "intro", completedAt: "x", updatedAt: "x" }), 80)),
      save: () => {},
      clear: () => {},
    };
    const tour = make({ progress: { store }, waitBudget: 0 });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["bypassed:completed"]);
  });

  it("ignores a second start() while the load is pending", async () => {
    const load = vi.fn(() => new Promise<null>((resolve) => setTimeout(() => resolve(null), 20)));
    const tour = make({ progress: { store: { load, save: () => {}, clear: () => {} } } });
    const log = watch(tour);
    await Promise.all([tour.start(), tour.start()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(log).toEqual(["started", "shown:a"]);
  });

  it.each([
    ["a throwing load", { load: () => { throw new Error("boom"); } }],
    ["a rejecting load", { load: () => Promise.reject(new Error("boom")) }],
    ["a malformed record", { load: () => ({ nonsense: true }) as unknown as ProgressRecord }],
  ])("%s does not break start()", async (_name, partial) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = { ...memoryStore(), ...partial } as ProgressStore;
    const tour = make({ progress: { store } });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["started", "shown:a"]);
  });

  it("a throwing or rejecting save does not break the tour", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let mode: "throw" | "reject" = "throw";
    const store: ProgressStore = {
      load: () => null,
      save: () => {
        if (mode === "throw") throw new Error("boom");
        return Promise.reject(new Error("boom"));
      },
      clear: () => {},
    };
    const tour = make({ progress: { store } });
    await tour.start();
    mode = "reject";
    await tour.forward();
    await new Promise((r) => setTimeout(r, 0));
    expect(tour.currentStep?.id).toBe("b");
    tour.finish();
    expect(warn).toHaveBeenCalled();
  });

  it("runs async saves one after another in order", async () => {
    const events: string[] = [];
    const store: ProgressStore = {
      load: () => null,
      save: (record) => {
        const label = record.lastStepId ?? "done";
        events.push(`begin:${label}`);
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            events.push(`end:${label}`);
            resolve();
          }, record.lastStepId === "a" ? 30 : 0)
        );
      },
      clear: () => {},
    };
    const tour = make({ progress: { store } });
    await tour.start();
    await tour.forward();
    tour.finish();
    await new Promise((r) => setTimeout(r, 100));
    expect(events).toEqual(["begin:a", "end:a", "begin:b", "end:b", "begin:done", "end:done"]);
  });

  it("start() waits for pending saves before loading", async () => {
    const records = new Map<string, ProgressRecord>();
    const store: ProgressStore = {
      load: (id) => records.get(id) ?? null,
      save: (record) => new Promise<void>((resolve) => setTimeout(() => { records.set(record.tourId, record); resolve(); }, 20)),
      clear: () => {},
    };
    const first = make({ progress: { store } });
    await first.start();
    first.finish();
    const log = watch(first);
    await first.start();
    expect(log).toEqual(["bypassed:completed"]);
  });

  it("ignores a record whose fields have the wrong type", async () => {
    const store: ProgressStore = {
      load: () => ({ tourId: "intro", updatedAt: "x", completedAt: true, lastStepId: 4 }) as unknown as ProgressRecord,
      save: () => {},
      clear: () => {},
    };
    const tour = make({ progress: { store, resume: true } });
    const log = watch(tour);
    await tour.start();
    expect(log).toEqual(["started", "shown:a"]);
  });

  it("a goTo during a pending load wins and start() does not start a second run", async () => {
    const store: ProgressStore = {
      load: () => new Promise((resolve) => setTimeout(() => resolve({ tourId: "intro", completedAt: "x", updatedAt: "x" }), 30)),
      save: () => {},
      clear: () => {},
    };
    const tour = make({ progress: { store } });
    const log = watch(tour);
    const pending = tour.start();
    await tour.goTo("c");
    await pending;
    expect(log).toEqual(["started", "shown:c"]);
  });

  it("warns in dev when progress is set without an id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createTour({ progress: { store: memoryStore() } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("`id`");
  });

  it("does not warn with an id or without progress", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createTour({ id: "x", progress: { store: memoryStore() } });
    createTour({});
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps working with no progress config", async () => {
    const tour = make();
    const log = watch(tour);
    await tour.start();
    tour.finish();
    expect(log).toEqual(["started", "shown:a", "finished"]);
  });
});
