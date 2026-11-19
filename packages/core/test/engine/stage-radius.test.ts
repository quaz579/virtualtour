import { describe, expect, it } from "vitest";
import {
  generateExtraCutoutsPathString,
  generateStageSvgPathString,
  stageCutout,
} from "../../src/engine/overlay/stage";
import { createDriver, nextFrame, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const stage = { x: 100, y: 50, width: 200, height: 80 };
const subpath = (d: string) => d.split("Z")[1]!.trim();
const arcs = (d: string) => [...subpath(d).matchAll(/a(\d+),(\d+) 0 0 1 (-?\d+),(-?\d+)/g)].map(m => m.slice(1).map(Number));

describe("generateStageSvgPathString", () => {
  it("keeps the uniform-number path string unchanged", () => {
    const d = generateStageSvgPathString(stage, { padding: 10, radius: 5 });
    const w = window.innerWidth;
    const h = window.innerHeight;

    expect(d).toBe(
      `M${w},0L0,0L0,${h}L${w},${h}L${w},0Z
    M95,40 h210 a5,5 0 0 1 5,5 v90 a5,5 0 0 1 -5,5 h-210 a5,5 0 0 1 -5,-5 v-90 a5,5 0 0 1 5,-5 z`
    );
  });

  it("draws one arc per corner in top-right, bottom-right, bottom-left, top-left order", () => {
    const d = generateStageSvgPathString(stage, {
      padding: 0,
      radius: { topLeft: 0, topRight: 10, bottomRight: 10, bottomLeft: 0 },
    });

    expect(subpath(d)).toBe(
      "M100,50 h190 a10,10 0 0 1 10,10 v60 a10,10 0 0 1 -10,10 h-190 a0,0 0 0 1 -0,-0 v-80 a0,0 0 0 1 0,-0 z"
    );
    expect(arcs(d).map(a => a[0])).toEqual([10, 10, 0, 0]);
  });

  it("gives each corner its own radius", () => {
    const d = generateStageSvgPathString(stage, {
      padding: 0,
      radius: { topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 },
    });

    expect(arcs(d).map(a => a[0])).toEqual([2, 3, 4, 1]);
    expect(subpath(d).startsWith("M101,50 h197 ")).toBe(true);
  });

  it("makes a number and four equal corners produce the same path", () => {
    const four = { topLeft: 7, topRight: 7, bottomRight: 7, bottomLeft: 7 };

    expect(generateStageSvgPathString(stage, { padding: 3, radius: four })).toBe(
      generateStageSvgPathString(stage, { padding: 3, radius: 7 })
    );
  });
});

describe("stageCutout radius clamping", () => {
  it("limits each corner to half the width and half the height", () => {
    const cutout = stageCutout(stage, {
      padding: 0,
      radius: { topLeft: 500, topRight: 41, bottomRight: 40, bottomLeft: 3 },
    });

    expect(cutout.radii).toEqual({ topLeft: 40, topRight: 40, bottomRight: 40, bottomLeft: 3 });
  });

  it("floors fractions and treats negatives and missing corners as zero", () => {
    const cutout = stageCutout(stage, {
      padding: 0,
      radius: { topLeft: 4.9, topRight: -3 } as never,
    });

    expect(cutout.radii).toEqual({ topLeft: 4, topRight: 0, bottomRight: 0, bottomLeft: 0 });
  });

  it("clamps a number against the padded box", () => {
    expect(stageCutout(stage, { padding: 0, radius: 99 }).radii.topLeft).toBe(40);
    expect(stageCutout(stage, { padding: 10, radius: 99 }).radii.topLeft).toBe(50);
  });
});

describe("generateExtraCutoutsPathString", () => {
  const cutout = stageCutout(stage, {
    padding: 0,
    radius: { topLeft: 4, topRight: 8, bottomRight: 12, bottomLeft: 16 },
  });

  const patch = (rect: { x: number; y: number; width: number; height: number }) =>
    generateExtraCutoutsPathString(cutout, [rect]);

  it("patches the top-left corner with the top-left radius", () => {
    expect(patch({ x: 90, y: 40, width: 20, height: 20 })).toContain("M100,50h4a4,4 0 0 0 -4,4z");
  });

  it("patches the top-right corner with the top-right radius", () => {
    expect(patch({ x: 292, y: 42, width: 20, height: 20 })).toContain("M300,50h-8a8,8 0 0 1 8,8z");
  });

  it("patches the bottom-right corner with the bottom-right radius", () => {
    expect(patch({ x: 285, y: 120, width: 30, height: 30 })).toContain("M300,130h-12a12,12 0 0 0 12,-12z");
  });

  it("patches the bottom-left corner with the bottom-left radius", () => {
    expect(patch({ x: 90, y: 115, width: 20, height: 30 })).toContain("M100,130h16a16,16 0 0 1 -16,-16z");
  });

  it("adds no patch for a zero-radius corner", () => {
    const square = stageCutout(stage, {
      padding: 0,
      radius: { topLeft: 0, topRight: 8, bottomRight: 12, bottomLeft: 16 },
    });

    expect(generateExtraCutoutsPathString(square, [{ x: 90, y: 40, width: 12, height: 12 }])).not.toContain("a0,0");
  });
});

describe("engine stageRadius", () => {
  const radii = () =>
    arcs(document.querySelector("[data-vt-overlay] path")!.getAttribute("d")!).map(a => a[0]);

  it("renders the config corner object", async () => {
    const d = createDriver({
      animate: false,
      stagePadding: 10,
      stageRadius: { topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 },
      steps: SAMPLE_STEPS,
    });
    d.drive();
    await nextFrame();

    expect(radii()).toEqual([2, 3, 4, 1]);
  });

  it("lets a step switch between corner and number forms and fall back to the config", async () => {
    const d = createDriver({
      animate: false,
      stagePadding: 10,
      stageRadius: 6,
      steps: [
        { ...SAMPLE_STEPS[0], stageRadius: { topLeft: 0, topRight: 9, bottomRight: 9, bottomLeft: 0 } },
        { ...SAMPLE_STEPS[1], stageRadius: 2 },
        SAMPLE_STEPS[2],
      ],
    });
    d.drive();
    await nextFrame();
    expect(radii()).toEqual([9, 9, 0, 0]);

    d.moveNext();
    await nextFrame();
    expect(radii()).toEqual([2, 2, 2, 2]);

    d.moveNext();
    await nextFrame();
    expect(radii()).toEqual([6, 6, 6, 6]);
  });
});
