import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, box, openFixture, popover, settle, title } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

type Side = "top" | "right" | "bottom" | "left" | "auto";
type Align = "start" | "center" | "end";
type Rect = { left: number; top: number; right: number; bottom: number };

async function placeTarget(page: Page, css: string) {
  await page.evaluate(css => {
    document.querySelector("#slot")!.innerHTML = `<button id="edge" type="button" style="position:fixed;${css}">Edge</button>`;
  }, css);
}

async function show(
  page: Page,
  options: { side: Side; align?: Align; flip?: boolean; shift?: boolean }
) {
  await page.evaluate(options => {
    window.tour?.destroy();
    window.tour = window.__engine.createEngine({ animate: false, stagePadding: 0, popoverOffset: 0 });
    window.tour.highlight({ element: "#edge", popover: { title: "Placement", description: "Placed", ...options } });
  }, options);
  await expect(title(page)).toHaveText("Placement");
  await settle(page);
}

async function rectOf(page: Page, selector: string): Promise<Rect> {
  const found = await box(page.locator(selector));

  return { left: found.x, top: found.y, right: found.x + found.width, bottom: found.y + found.height };
}

const viewport = (page: Page) => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
const sideOf = (page: Page) => popover(page).evaluate(element => element.getAttribute("data-vt-side"));

async function expectArrowPointsAtTarget(page: Page) {
  const target = await rectOf(page, "#edge");
  const arrow = await rectOf(page, ".vt-popover-arrow");
  const pop = await rectOf(page, ".vt-popover");
  const arrowSide = await page
    .locator(".vt-popover-arrow")
    .evaluate(element => [...element.classList].find(name => name.startsWith("vt-popover-arrow-side-"))!.slice(22));
  const x = (arrow.left + arrow.right) / 2;
  const y = (arrow.top + arrow.bottom) / 2;

  if (arrowSide === "top" || arrowSide === "bottom") {
    expect(x).toBeGreaterThanOrEqual(target.left - 2);
    expect(x).toBeLessThanOrEqual(target.right + 2);
    expect(Math.abs(y - (arrowSide === "bottom" ? pop.top : pop.bottom))).toBeLessThan(12);
  } else {
    expect(y).toBeGreaterThanOrEqual(target.top - 2);
    expect(y).toBeLessThanOrEqual(target.bottom + 2);
    expect(Math.abs(x - (arrowSide === "right" ? pop.left : pop.right))).toBeLessThan(12);
  }
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("side auto", () => {
  for (const size of [
    { width: 1280, height: 400 },
    { width: 500, height: 900 },
  ]) {
    test(`a top-right target gets the popover on the side with more room at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await placeTarget(page, "right:20px;top:20px;width:80px;height:30px");
      await show(page, { side: "auto" });

      const target = await rectOf(page, "#edge");
      const { width, height } = await viewport(page);
      const left = target.left;
      const bottom = height - target.bottom;
      const expected = left > bottom ? "left" : "bottom";

      expect(["left", "bottom"]).toContain(expected);
      expect(await sideOf(page)).toBe(expected);
      const pop = await rectOf(page, ".vt-popover");
      expect(pop.left).toBeGreaterThanOrEqual(-1);
      expect(pop.right).toBeLessThanOrEqual(width + 1);
      expect(pop.bottom).toBeLessThanOrEqual(height + 1);
      await expectArrowPointsAtTarget(page);
    });
  }
});

test.describe("flip and shift off", () => {
  test("a left-edge target pushes a left popover visibly past the viewport and the arrow still points at it", async ({
    page,
  }) => {
    await placeTarget(page, "left:0;top:300px;width:60px;height:30px");
    await show(page, { side: "left", flip: false, shift: false });

    expect(await sideOf(page)).toBe("left");
    expect((await rectOf(page, ".vt-popover")).left).toBeLessThan(0);
    await expectArrowPointsAtTarget(page);
  });

  test("a bottom-edge target pushes a bottom popover past the viewport bottom", async ({ page }) => {
    await placeTarget(page, "left:400px;bottom:0;width:80px;height:30px");
    await show(page, { side: "bottom", flip: false, shift: false });

    const { height } = await viewport(page);
    expect(await sideOf(page)).toBe("bottom");
    expect((await rectOf(page, ".vt-popover")).bottom).toBeGreaterThan(height);
    await expectArrowPointsAtTarget(page);
  });

  test("the same target flips and stays inside the viewport with the defaults", async ({ page }) => {
    await placeTarget(page, "left:400px;bottom:0;width:80px;height:30px");
    await show(page, { side: "bottom" });

    const { height } = await viewport(page);
    expect(await sideOf(page)).not.toBe("bottom");
    expect((await rectOf(page, ".vt-popover")).bottom).toBeLessThanOrEqual(height + 1);
    await expectArrowPointsAtTarget(page);
  });

  test("shift off alone lets an end-aligned popover run off the left edge", async ({ page }) => {
    await placeTarget(page, "left:0;top:300px;width:60px;height:30px");
    await show(page, { side: "top", align: "end", flip: false, shift: false });

    expect((await rectOf(page, ".vt-popover")).left).toBeLessThan(0);
    await expectArrowPointsAtTarget(page);
  });
});

test.describe("alignment flip", () => {
  test("a start-aligned popover under a right-edge target turns end-aligned and stays inside", async ({ page }) => {
    await placeTarget(page, "right:12px;top:300px;width:80px;height:30px");
    await show(page, { side: "bottom", align: "start" });

    const { width } = await viewport(page);
    const pop = await rectOf(page, ".vt-popover");
    await expect(popover(page)).toHaveClass(/vt-popover-align-end/);
    expect(pop.right).toBeLessThanOrEqual(width + 1);
    expect(pop.right).toBeGreaterThanOrEqual((await rectOf(page, "#edge")).right - 12);
    await expectArrowPointsAtTarget(page);
  });

  test("flip off keeps start and shifts the popover inside the viewport", async ({ page }) => {
    await placeTarget(page, "right:12px;top:300px;width:80px;height:30px");
    await show(page, { side: "bottom", align: "start", flip: false });

    const { width } = await viewport(page);
    await expect(popover(page)).toHaveClass(/vt-popover-align-start/);
    expect((await rectOf(page, ".vt-popover")).right).toBeLessThanOrEqual(width + 1);
    await expectArrowPointsAtTarget(page);
  });
});
