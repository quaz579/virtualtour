import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { progressVars } from "../../src/motion";
import { install, start, uninstall, wrapper } from "./harness";

const steps = [
  { id: "one", title: "One", target: "#a" },
  { id: "two", title: "Two", target: "#b" },
  { id: "three", title: "Three", target: "#c" },
];

beforeEach(install);
afterEach(uninstall);

const vars = (): [string, string] => [
  wrapper().style.getPropertyValue("--vt-progress-index"),
  wrapper().style.getPropertyValue("--vt-progress-total"),
];

describe("progressVars", () => {
  it("sets the index and total on each popover as steps change", async () => {
    const tour = await start({ steps });
    progressVars(tour);
    await tour.forward();
    expect(vars()).toEqual(["2", "3"]);
    await tour.forward();
    expect(vars()).toEqual(["3", "3"]);
    await tour.backward();
    expect(vars()).toEqual(["2", "3"]);
  });

  it("applies right away when a step is already on screen", async () => {
    const tour = await start({ steps });
    progressVars(tour);
    expect(vars()).toEqual(["1", "3"]);
  });

  it("counts a step added mid-tour in the total", async () => {
    const tour = await start({ steps });
    progressVars(tour);
    tour.appendStep({ id: "four", title: "Four" });
    await tour.forward();
    expect(vars()).toEqual(["2", "4"]);
  });

  it("updates the total on screen when a step is appended mid-step", async () => {
    const tour = await start({ steps });
    progressVars(tour);
    tour.appendStep({ id: "four", title: "Four" });
    expect(vars()).toEqual(["1", "4"]);
  });

  it("updates the index when a step is inserted before the one on screen", async () => {
    const tour = await start({ steps });
    await tour.forward();
    progressVars(tour);
    tour.appendStep({ id: "zero", title: "Zero" }, 0);
    expect(vars()).toEqual(["3", "4"]);
  });

  it("updates the total and index when a step is dropped mid-step", async () => {
    const tour = await start({ steps });
    await tour.forward();
    progressVars(tour);
    tour.dropStep("three");
    expect(vars()).toEqual(["2", "2"]);
    tour.dropStep("one");
    expect(vars()).toEqual(["1", "1"]);
  });

  it("stops reacting to step list changes after off()", async () => {
    const tour = await start({ steps });
    const off = progressVars(tour);
    off();
    tour.appendStep({ id: "four", title: "Four" });
    expect(vars()).toEqual(["", ""]);
  });

  it("off() removes the variables and stops updating", async () => {
    const tour = await start({ steps });
    const off = progressVars(tour);
    off();
    expect(vars()).toEqual(["", ""]);
    await tour.forward();
    expect(vars()).toEqual(["", ""]);
  });

  it("works on a tour that has not started", async () => {
    const tour = await start({ steps });
    tour.finish();
    const off = progressVars(tour);
    expect(() => off()).not.toThrow();
  });
});
