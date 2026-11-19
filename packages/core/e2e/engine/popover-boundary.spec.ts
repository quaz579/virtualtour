import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, box, openFixture, popover, settle, title } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

type Side = "top" | "right" | "bottom" | "left" | "over";
type Bounds = { left: number; top: number; right: number; bottom: number };

const SCROLLER = { left: 120, top: 200, width: 320, height: 240 };

async function addScroller(page: Page, targetOffset: number) {
  await page.evaluate(
    ({ scroller, targetOffset }) => {
      document.querySelector("#slot")!.innerHTML = `
        <div id="scroller" style="position:fixed;left:${scroller.left}px;top:${scroller.top}px;width:${scroller.width}px;height:${scroller.height}px;overflow:auto;border:1px solid #999;background:#eef">
          <div style="height:${targetOffset}px"></div>
          <button id="inner" type="button" style="width:80px;height:30px">Inner</button>
          <div style="height:600px"></div>
        </div>
      `;
    },
    { scroller: SCROLLER, targetOffset }
  );
}

async function show(page: Page, element: string, side: Side, config: Record<string, unknown> = {}) {
  await page.evaluate(
    ({ element, side, config }) => {
      window.tour?.destroy();
      window.tour = window.__engine.createEngine({ animate: false, stagePadding: 0, popoverOffset: 0, ...config });
      window.tour.highlight({ element, popover: { title: "Boundary", description: "Placed", side } });
    },
    { element, side, config }
  );
  await expect(title(page)).toHaveText("Boundary");
  await settle(page);
}

async function popoverBox(page: Page): Promise<Bounds> {
  const rect = await box(popover(page));

  return { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height };
}

const inside = (rect: Bounds, bounds: Bounds) => {
  expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
  expect(rect.top).toBeGreaterThanOrEqual(bounds.top - 1);
  expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
  expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
};

const viewportBounds = (page: Page, inset = 0) =>
  page.evaluate(
    inset => ({ left: inset, top: inset, right: window.innerWidth - inset, bottom: window.innerHeight - inset }),
    inset
  );

const sideOf = (page: Page) => popover(page).evaluate(element => element.getAttribute("data-vt-side"));

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("fixed header layout", () => {
  test("a popover padded below a fixed header stays inside the padded viewport", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `
        <div id="header" style="position:fixed;left:0;top:0;width:100%;height:60px;background:#ccd"></div>
        <button id="near-top" type="button" style="position:fixed;left:300px;top:70px;width:100px;height:30px">Near top</button>
      `;
    });
    await show(page, "#near-top", "top", { popoverPadding: 60 });

    inside(await popoverBox(page), await viewportBounds(page, 60));
    expect(await sideOf(page)).not.toBe("top");
  });

  test("padding 0 keeps the popover above a target the header does not reach", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `
        <button id="mid" type="button" style="position:fixed;left:300px;top:300px;width:100px;height:30px">Mid</button>
      `;
    });
    await show(page, "#mid", "top");

    expect(await sideOf(page)).toBe("top");
    inside(await popoverBox(page), await viewportBounds(page));
  });
});

test.describe("nested scroller layout", () => {
  test("flips away from the bottom edge of the scroller", async ({ page }) => {
    await addScroller(page, 150);
    await show(page, "#inner", "bottom");

    const bounds = { left: 0, top: SCROLLER.top, right: 10000, bottom: SCROLLER.top + SCROLLER.height };
    expect(await sideOf(page)).not.toBe("bottom");
    inside(await popoverBox(page), { ...bounds, right: await page.evaluate(() => window.innerWidth) });
  });

  test("the viewport boundary lets the popover cross the scroller edge", async ({ page }) => {
    await addScroller(page, 150);
    await show(page, "#inner", "bottom", { popoverBoundary: "viewport" });

    expect(await sideOf(page)).toBe("bottom");
  });

  test("stays inside the scroller after the target scrolls", async ({ page }) => {
    await addScroller(page, 100);
    await show(page, "#inner", "top");
    await page.locator("#scroller").evaluate(element => element.scrollBy(0, 40));
    await expect.poll(() => popoverBox(page).then(rect => rect.top)).toBeGreaterThanOrEqual(SCROLLER.top - 1);
    await page.evaluate(() => window.tour.refresh());
    await settle(page);

    expect((await popoverBox(page)).top).toBeGreaterThanOrEqual(SCROLLER.top - 1);
  });
});

test.describe("long page layout", () => {
  test("a target at the page bottom keeps the popover inside the viewport", async ({ page }) => {
    await show(page, "#far", "bottom");

    inside(await popoverBox(page), await viewportBounds(page));
  });
});

test.describe("side over", () => {
  test("highlights the target and centers the popover without an arrow", async ({ page }) => {
    await show(page, "#intro", "over");

    await expect(page.locator("#intro")).toHaveAttribute("data-vt-target");
    await expect(page.locator(".vt-popover-arrow")).toHaveClass(/vt-popover-arrow-none/);
    const rect = await popoverBox(page);
    const viewport = await viewportBounds(page);
    expect((rect.left + rect.right) / 2).toBeCloseTo(viewport.right / 2, 0);
    expect((rect.top + rect.bottom) / 2).toBeCloseTo(viewport.bottom / 2, 0);
  });
});
