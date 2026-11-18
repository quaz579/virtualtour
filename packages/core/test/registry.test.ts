import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../src/index";
import { setCurrentTour } from "../src/registry";
import { emitTour } from "../src/tour";

afterEach(() => {
  setCurrentTour(null);
  tours.off();
  vi.restoreAllMocks();
});

describe("tours registry", () => {
  it("starts with no current tour", () => {
    expect(tours.current).toBeNull();
  });

  it("tracks the current tour and clears it", () => {
    const a = createTour();
    const b = createTour();
    setCurrentTour(a);
    expect(tours.current).toBe(a);
    setCurrentTour(b);
    expect(tours.current).toBe(b);
    setCurrentTour(null);
    expect(tours.current).toBeNull();
  });

  it("relays a tour event after the tour's own listeners", () => {
    const tour = createTour();
    const order: string[] = [];
    tours.on("started", () => order.push("registry"));
    tour.on("started", () => order.push("tour"));
    emitTour(tour, "started", { tour });
    expect(order).toEqual(["tour", "registry"]);
  });

  it("relays every tour event with its payload", () => {
    const tour = createTour({ steps: [{}, {}] });
    const [first, second] = tour.steps;
    const payloads = {
      started: { tour },
      activated: { tour },
      deactivated: { tour },
      "step-shown": { tour, step: second!, previous: first! },
      "step-completed": { tour, step: first! },
      finished: { tour },
      exited: { tour, reason: "replaced" as const },
      bypassed: { tour, reason: "completed" as const },
    };
    for (const [name, payload] of Object.entries(payloads)) {
      const seen = vi.fn();
      tours.on(name as keyof typeof payloads, seen);
      emitTour(tour, name as keyof typeof payloads, payload as never);
      expect(seen, name).toHaveBeenCalledTimes(1);
      expect(seen, name).toHaveBeenCalledWith(payload);
    }
  });

  it("relays events from several tours", () => {
    const a = createTour();
    const b = createTour();
    const seen = vi.fn();
    tours.on("finished", seen);
    emitTour(a, "finished", { tour: a });
    emitTour(b, "finished", { tour: b });
    expect(seen.mock.calls.map(([p]) => p.tour)).toEqual([a, b]);
  });

  it("supports once, off and the unsubscribe function", () => {
    const tour = createTour();
    const once = vi.fn();
    const off = vi.fn();
    const unsub = vi.fn();
    tours.once("started", once);
    tours.on("started", off);
    const remove = tours.on("started", unsub);
    tours.off("started", off);
    remove();
    emitTour(tour, "started", { tour });
    emitTour(tour, "started", { tour });
    expect(once).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
    expect(unsub).not.toHaveBeenCalled();
  });

  it("keeps relaying when a registry handler throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tour = createTour();
    const after = vi.fn();
    tours.on("started", () => {
      throw new Error("boom");
    });
    tours.on("started", after);
    emitTour(tour, "started", { tour });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("does not leak the tour's own listeners to the registry", () => {
    const tour = createTour();
    const own = vi.fn();
    tour.on("started", own);
    tours.off();
    emitTour(tour, "started", { tour });
    expect(own).toHaveBeenCalledTimes(1);
  });
});
