import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, box, near, openFixture, popover, settle, title } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

const FIXTURES = { ltr: "/e2e.html", rtl: "/e2e-rtl.html" } as const;

type Setup = { target?: string; align?: "start" | "end" | "center"; arrow?: boolean; arrowMinInset?: number };

async function show(page: Page, { target = "#heading", align = "start", arrow, arrowMinInset }: Setup = {}) {
  await page.evaluate(
    ({ target, align, arrow, arrowMinInset }) => {
      window.tour?.destroy();
      window.tour = window.__engine.createEngine({ animate: false, stagePadding: 0, popoverOffset: 10 });
      window.tour.highlight({
        element: target,
        popover: {
          title: "Arrow",
          description: "Placed",
          side: "bottom",
          align,
          flip: false,
          shift: false,
          ...(arrow === undefined ? {} : { arrow }),
          ...(arrowMinInset === undefined ? {} : { arrowMinInset }),
        },
      });
    },
    { target, align, arrow, arrowMinInset }
  );
  await expect(title(page)).toHaveText("Arrow");
  await settle(page);
}

const arrowBox = (page: Page) => box(page.locator(".vt-popover-arrow"));

test("vt-no-arrow hides the arrow", async ({ page }) => {
  await openFixture(page);
  await show(page, { arrow: false });

  await expect(popover(page)).toHaveClass(/vt-no-arrow/);
  expect(await page.locator(".vt-popover-arrow").evaluate(el => el.getBoundingClientRect().width)).toBe(0);
});

test("the arrow is visible by default", async ({ page }) => {
  await openFixture(page);
  await show(page);

  await expect(popover(page)).not.toHaveClass(/vt-no-arrow/);
  expect(await page.locator(".vt-popover-arrow").evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(0);
});

test("a hidden arrow leaves the popover offset px from the target", async ({ page }) => {
  await openFixture(page);
  await show(page, { arrow: false });
  const target = await box(page.locator("#heading"));
  const pop = await box(popover(page));

  near(pop.y, target.y + target.height + 10);
});

for (const dir of ["ltr", "rtl"] as const) {
  test.describe(`minInset ${dir}`, () => {
    test.beforeEach(async ({ page }) => {
      await openFixture(page, FIXTURES[dir]);
    });

    for (const inset of [15, 30, 60]) {
      test(`start alignment keeps the arrow ${inset}px from the inline-start corner`, async ({ page }) => {
        await show(page, { align: "start", arrowMinInset: inset });
        const pop = await box(popover(page));
        const arrow = await arrowBox(page);

        if (dir === "ltr") {
          near(arrow.x - pop.x, inset);
        } else {
          near(pop.x + pop.width - (arrow.x + arrow.width), inset);
        }
      });

      test(`end alignment keeps the arrow ${inset}px from the inline-end corner`, async ({ page }) => {
        await show(page, { align: "end", arrowMinInset: inset });
        const pop = await box(popover(page));
        const arrow = await arrowBox(page);

        if (dir === "ltr") {
          near(pop.x + pop.width - (arrow.x + arrow.width), inset);
        } else {
          near(arrow.x - pop.x, inset);
        }
      });
    }
  });
}
