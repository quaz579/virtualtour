import { expect, test, type Page } from "@playwright/test";
import { box, openFixture, overlay, settle, skipWhenEdgeMissing } from "./harness";

test.beforeEach(skipWhenEdgeMissing);
test.beforeEach(({}, testInfo) => {
  testInfo.skip(testInfo.project.name !== "chromium", "pixel checks run in chromium");
});

type Radius = number | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
type Corner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

const PADDING = 20;
const INSET = 2;

async function highlight(page: Page, config: { stageRadius?: Radius }, step: { stageRadius?: Radius } = {}) {
  await page.evaluate(
    ({ config, step }) => {
      window.tour?.destroy();
      window.tour = window.__engine.createEngine({
        animate: false,
        overlayColor: "rgb(0,0,0)",
        overlayOpacity: 1,
        stagePadding: 20,
        ...config,
      });
      window.tour.highlight({ element: "#target", popover: { title: "Target", side: "bottom" }, ...step });
    },
    { config, step }
  );
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
}

async function darkCorners(page: Page, cutout: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot()).toString("base64");
  const points = {
    topLeft: [cutout.x + INSET, cutout.y + INSET],
    topRight: [cutout.x + cutout.width - 1 - INSET, cutout.y + INSET],
    bottomRight: [cutout.x + cutout.width - 1 - INSET, cutout.y + cutout.height - 1 - INSET],
    bottomLeft: [cutout.x + INSET, cutout.y + cutout.height - 1 - INSET],
  } as Record<Corner, number[]>;

  return page.evaluate(
    async ({ png, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      const result: Record<string, boolean> = {};
      for (const [corner, [x, y]] of Object.entries(points)) {
        const [r, g, b] = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        result[corner] = r + g + b < 30;
      }
      return result;
    },
    { png, points }
  );
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    const element = document.createElement("div");
    element.id = "target";
    element.style.cssText = "position:fixed;background:#cdd;left:540px;top:320px;width:200px;height:80px";
    document.body.appendChild(element);
    document.body.style.background = "#fff";
  });
});

async function cutoutBox(page: Page) {
  const element = await box(page.locator("#target"));

  return {
    x: element.x - PADDING,
    y: element.y - PADDING,
    width: element.width + PADDING * 2,
    height: element.height + PADDING * 2,
  };
}

test.describe("per-corner cut-out radius", () => {
  test("a number rounds all four corners", async ({ page }) => {
    await highlight(page, { stageRadius: 16 });

    expect(await darkCorners(page, await cutoutBox(page))).toEqual({
      topLeft: true,
      topRight: true,
      bottomRight: true,
      bottomLeft: true,
    });
  });

  test("zero keeps all four corners sharp", async ({ page }) => {
    await highlight(page, { stageRadius: 0 });

    expect(await darkCorners(page, await cutoutBox(page))).toEqual({
      topLeft: false,
      topRight: false,
      bottomRight: false,
      bottomLeft: false,
    });
  });

  test("zero corners are sharp and nonzero corners are rounded", async ({ page }) => {
    await highlight(page, { stageRadius: { topLeft: 0, topRight: 16, bottomRight: 0, bottomLeft: 16 } });

    expect(await darkCorners(page, await cutoutBox(page))).toEqual({
      topLeft: false,
      topRight: true,
      bottomRight: false,
      bottomLeft: true,
    });
  });

  test("each corner rounds on its own", async ({ page }) => {
    const corners: Corner[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
    for (const rounded of corners) {
      await highlight(page, {
        stageRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0, [rounded]: 16 },
      });
      const result = await darkCorners(page, await cutoutBox(page));

      expect(result).toEqual(Object.fromEntries(corners.map(corner => [corner, corner === rounded])));
    }
  });

  test("a step radius overrides the config radius", async ({ page }) => {
    await highlight(
      page,
      { stageRadius: 16 },
      { stageRadius: { topLeft: 16, topRight: 0, bottomRight: 16, bottomLeft: 0 } }
    );

    expect(await darkCorners(page, await cutoutBox(page))).toEqual({
      topLeft: true,
      topRight: false,
      bottomRight: true,
      bottomLeft: false,
    });
  });

  test("a radius larger than the box is clamped and the cut-out stays closed", async ({ page }) => {
    await highlight(page, { stageRadius: { topLeft: 500, topRight: 0, bottomRight: 0, bottomLeft: 0 } });
    const cutout = await cutoutBox(page);

    expect(await darkCorners(page, cutout)).toMatchObject({ topLeft: true, topRight: false });
    const center = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.id,
      { x: cutout.x + cutout.width / 2, y: cutout.y + cutout.height / 2 }
    );
    expect(center).toBe("target");
  });
});
