import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, box, near, openFixture, popover, settle, title } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

async function show(page: Page, strategy: "fixed" | "absolute", extra: Record<string, unknown> = {}) {
  await page.evaluate(
    ({ strategy, extra }) => {
      const app = document.querySelector<HTMLElement>("#app")!;
      app.style.cssText = "transform:translateZ(0);position:relative;margin-top:400px;height:50px";
      window.tour?.destroy();
      window.tour = window.__engine.createEngine({
        animate: false,
        stagePadding: 0,
        popoverOffset: 0,
        mountIn: () => app,
        ...extra,
      });
      window.tour.highlight({
        element: "#one",
        popover: { title: "Strategy", description: "Placed", side: "bottom", align: "start", strategy },
      });
    },
    { strategy, extra }
  );
  await expect(title(page)).toHaveText("Strategy");
  await settle(page);
}

async function gap(page: Page) {
  const target = await box(page.locator("#one"));
  const pop = await box(popover(page));

  return { dx: pop.x - target.x, dy: pop.y - (target.y + target.height) };
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test("fixed inside a transformed container is offset from the target", async ({ page }) => {
  await show(page, "fixed");

  const { dy } = await gap(page);
  expect(Math.abs(dy)).toBeGreaterThan(20);
});

test("absolute inside a transformed container sits next to the target", async ({ page }) => {
  await show(page, "absolute");

  const { dx, dy } = await gap(page);
  near(dx, 0);
  near(dy, 0);
  await expect(popover(page)).toHaveAttribute("data-vt-strategy", "absolute");
});

test("absolute stays attached after the page scrolls", async ({ page }) => {
  await show(page, "absolute");

  await page.evaluate(() => window.scrollBy(0, 200));
  await settle(page);
  await page.waitForTimeout(100);

  const { dx, dy } = await gap(page);
  near(dx, 0);
  near(dy, 0);
});

test("centered steps stay fixed under absolute", async ({ page }) => {
  await show(page, "absolute");
  await page.evaluate(() => {
    window.tour.highlight({ popover: { title: "Centered", side: "over", strategy: "absolute" } });
  });
  await expect(title(page)).toHaveText("Centered");
  await settle(page);

  await expect(popover(page)).not.toHaveAttribute("data-vt-strategy", /.*/);
});
