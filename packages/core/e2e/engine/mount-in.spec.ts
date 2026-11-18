import { expect, test, type Page } from "@playwright/test";
import type { Config } from "../../src/engine/driver";
import { skipWhenEdgeMissing, box, clearLog, log, openFixture, overlay, popover, record, settle, topElementAt } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

const STEPS = [
  { element: "#one", popover: { title: "Step 1" } },
  { element: "#two", popover: { title: "Step 2" } },
];

async function start(page: Page, config: Record<string, unknown>) {
  await page.evaluate(config => {
    window.tour?.destroy();
    const resolved = { ...config } as Record<string, unknown>;
    for (const key of ["mountIn", "dimMountIn"]) {
      if (typeof resolved[key] === "string") {
        const selector = resolved[key] as string;
        resolved[key] = () => document.querySelector(selector)!;
      }
    }
    window.tour = window.__engine.createEngine({ animate: false, ...(resolved as Config) });
    window.tour.drive(0);
  }, { steps: STEPS, ...config });
  await expect(popover(page)).toHaveCount(1);
  await settle(page);
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

const parentId = (page: Page, selector: string) =>
  page.evaluate(selector => document.querySelector(selector)?.parentElement?.id ?? "none", selector);

test("mountIn places the popover inside #app next to the target", async ({ page }) => {
  await start(page, { mountIn: "#app" });
  expect(await parentId(page, ".vt-popover")).toBe("app");

  const target = await box(page.locator("#one"));
  const pop = await box(popover(page));
  const horizontalGap = Math.max(pop.x - (target.x + target.width), target.x - (pop.x + pop.width), 0);
  const verticalGap = Math.max(pop.y - (target.y + target.height), target.y - (pop.y + pop.height), 0);
  expect(Math.max(horizontalGap, verticalGap)).toBeLessThan(40);
});

test("the popover positions identically with and without mountIn", async ({ page }) => {
  await start(page, {});
  const body = await box(popover(page));
  await start(page, { mountIn: "#app" });
  const app = await box(popover(page));

  expect(Math.abs(app.x - body.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(app.y - body.y)).toBeLessThanOrEqual(1);
});

test("dimMountIn puts the overlay in #dim and it still blocks clicks outside the cut-out", async ({ page }) => {
  await record(page, "#three", ["click"]);
  await start(page, { dimMountIn: "#dim" });
  expect(await parentId(page, ".vt-overlay")).toBe("dim");
  await expect(overlay(page)).toHaveCount(1);

  const three = await box(page.locator("#three"));
  const x = three.x + three.width / 2;
  const y = three.y + three.height / 2;
  expect(await topElementAt(page, x, y)).toBe("overlay");

  await clearLog(page);
  await page.mouse.click(x, y);
  expect(await log(page)).toEqual([]);
});

test("the popover and overlay follow the tour through steps inside their containers", async ({ page }) => {
  await start(page, { mountIn: "#app", dimMountIn: "#dim" });
  await page.evaluate(() => window.tour.moveNext());
  await settle(page);

  expect(await parentId(page, ".vt-popover")).toBe("app");
  expect(await parentId(page, ".vt-overlay")).toBe("dim");
});
