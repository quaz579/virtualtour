import { describe, expect, it } from "vitest";
import { createTour, localStorageStore, memoryStore, tours, TourEnvironmentError, TourNavigationError } from "../src/index";

describe("tour model without a DOM", () => {
  it("runs with no DOM globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("creates a tour and edits its steps", () => {
    const tour = createTour({ name: "Server", steps: [{ id: "a" }, { id: "b" }] });
    tour.appendStep({ id: "c" }, "b");
    tour.dropStep("a");
    expect(tour.steps.map((s) => s.id)).toEqual(["c", "b"]);
    expect(tours.current).toBeNull();
  });

  it("start throws TourEnvironmentError", async () => {
    await expect(createTour().start()).rejects.toBeInstanceOf(TourEnvironmentError);
  });

  it("exports distinct error classes", () => {
    expect(new TourEnvironmentError("x").name).toBe("TourEnvironmentError");
    expect(new TourNavigationError("x")).toBeInstanceOf(Error);
    expect(new TourNavigationError("x")).not.toBeInstanceOf(TourEnvironmentError);
  });

  it("stores work without a DOM", async () => {
    const store = localStorageStore();
    expect(store.load("x")).toBeNull();
    expect(() => store.save({ tourId: "x", updatedAt: "u" })).not.toThrow();
    expect(() => store.clear("x")).not.toThrow();
    const memory = memoryStore();
    memory.save({ tourId: "x", updatedAt: "u" });
    expect(memory.load("x")).toEqual({ tourId: "x", updatedAt: "u" });
  });
});
