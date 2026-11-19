import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { glide } from "../../src/motion";
import { animations, install, positions, start, uninstall, wrapper } from "./harness";

const steps = [
  { id: "one", title: "One", target: "#a" },
  { id: "two", title: "Two", target: "#b" },
  { id: "three", title: "Three", target: "#c" },
  { id: "centered", title: "Centered" },
];

function place(): void {
  Object.assign(positions, {
    "0": { left: 100, top: 50 },
    "1": { left: 340, top: 210 },
    "2": { left: 20, top: 400 },
    "3": { left: 500, top: 300 },
  });
}

beforeEach(() => {
  install();
  place();
});
afterEach(uninstall);

describe("glide", () => {
  it("animates from the previous position to identity with the given options", async () => {
    const tour = await start({ steps });
    glide(tour, { durationMs: 400, easing: "linear" });
    await tour.forward();
    expect(animations).toHaveLength(1);
    expect(animations[0]!.keyframes).toEqual([{ transform: "translate(-240px, -160px)" }, { transform: "translate(0px, 0px)" }]);
    expect(animations[0]!.options).toMatchObject({ duration: 400, easing: "linear" });
  });

  it("uses 250 ms and the default easing when no options are given", async () => {
    const tour = await start({ steps });
    glide(tour);
    await tour.forward();
    expect(animations).toHaveLength(1);
    expect(animations[0]!.keyframes[0]).toEqual({ transform: "translate(-240px, -160px)" });
    expect(animations[0]!.options).toMatchObject({ duration: 250, easing: "cubic-bezier(.2,.8,.2,1)" });
  });

  it("marks the wrapper vt-glide while moving and removes it when the animation ends", async () => {
    const tour = await start({ steps });
    glide(tour);
    await tour.forward();
    expect(wrapper().classList.contains("vt-glide")).toBe(true);
    animations[0]!.finish();
    expect(wrapper().classList.contains("vt-glide")).toBe(false);
  });

  it("does not glide to the first step", async () => {
    const tour = await start({ steps });
    glide(tour);
    expect(animations).toHaveLength(0);
    expect(wrapper().classList.contains("vt-glide")).toBe(false);
  });

  it("does nothing when the position does not change", async () => {
    Object.assign(positions, { "1": { left: 100, top: 50 } });
    const tour = await start({ steps });
    glide(tour);
    await tour.forward();
    expect(animations).toHaveLength(0);
  });

  it("cancels the running glide on the next step change and starts a new one from the visible position", async () => {
    const tour = await start({ steps });
    glide(tour);
    await tour.forward();
    const first = animations[0]!;
    await tour.forward();
    expect(first.cancel).toHaveBeenCalled();
    expect(animations).toHaveLength(2);
    expect(animations[1]!.element).toBe(wrapper());
    expect(animations[1]!.keyframes[0]).toEqual({ transform: "translate(320px, -190px)" });
  });

  it("goes backward too", async () => {
    const tour = await start({ steps });
    glide(tour);
    await tour.forward();
    await tour.backward();
    expect(animations).toHaveLength(2);
    expect(animations[1]!.keyframes[0]).toEqual({ transform: "translate(240px, 160px)" });
  });

  it("is a no-op under reduced motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query }));
    const tour = await start({ steps });
    glide(tour);
    await tour.forward();
    expect(animations).toHaveLength(0);
    expect(wrapper().classList.contains("vt-glide")).toBe(false);
  });

  it("is a no-op when the tour has animate off", async () => {
    const tour = await start({ steps, animate: false });
    glide(tour);
    await tour.forward();
    expect(animations).toHaveLength(0);
  });

  it("is a no-op between a targeted and a centered step, both ways", async () => {
    const tour = await start({ steps: [steps[0]!, steps[3]!, steps[1]!] });
    glide(tour);
    await tour.forward();
    await tour.forward();
    expect(animations).toHaveLength(0);
  });

  it("glides between two centered steps", async () => {
    const tour = await start({ steps: [{ id: "x", title: "X" }, { id: "y", title: "Y" }] });
    glide(tour);
    await tour.forward();
    expect(animations).toHaveLength(1);
  });

  it("is a no-op when the popover layout differs between steps", async () => {
    const tour = await start({ steps });
    tour.steps[0]!.once("will-hide", () => wrapper().classList.remove("vt-dialog"));
    glide(tour);
    await tour.forward();
    expect(animations).toHaveLength(0);
  });

  it("does not glide across an exit and restart", async () => {
    const tour = await start({ steps });
    glide(tour);
    await tour.forward();
    animations.length = 0;
    await tour.exit();
    await tour.start();
    expect(animations).toHaveLength(0);
  });

  it("off() stops gliding and cancels the one in progress", async () => {
    const tour = await start({ steps });
    const off = glide(tour);
    await tour.forward();
    const running = animations[0]!;
    off();
    expect(running.cancel).toHaveBeenCalled();
    expect(wrapper().classList.contains("vt-glide")).toBe(false);
    await tour.forward();
    expect(animations).toHaveLength(1);
  });

  it("off() leaves no listeners on the steps", async () => {
    const tour = await start({ steps });
    const off = glide(tour);
    off();
    const on = vi.spyOn(tour.steps[1]!, "once");
    await tour.forward();
    expect(on).not.toHaveBeenCalled();
  });

  it("two glides on one tour each animate and each off() detaches only its own", async () => {
    const tour = await start({ steps });
    const offA = glide(tour);
    const offB = glide(tour);
    await tour.forward();
    expect(animations.length).toBe(2);
    offA();
    offB();
    await tour.forward();
    expect(animations.length).toBe(2);
  });
});
