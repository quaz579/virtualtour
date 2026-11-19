import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, box, openFixture, popover, settle, title } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

type Info = { side: string; targetRect: { x: number; y: number; width: number; height: number } | null };

async function highlight(page: Page, step: Record<string, unknown>) {
  await page.evaluate(step => {
    window.tour?.destroy();
    const infos: unknown[] = [];
    (window as unknown as { infos: unknown[] }).infos = infos;
    window.tour = window.__engine.createEngine({
      animate: false,
      onReposition: info => infos.push({ side: info.side, targetRect: info.targetRect && info.targetRect.toJSON() }),
    });
    window.tour.highlight(step as never);
  }, step);
  await expect(title(page)).toHaveText("Rect");
  await settle(page);
}

const lastInfo = (page: Page) =>
  page.evaluate(() => (window as unknown as { infos: Info[] }).infos.at(-1)!);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test("a step without a target reports no target rect and is centered", async ({ page }) => {
  await highlight(page, { popover: { title: "Rect", description: "Centered" } });

  const info = await lastInfo(page);
  expect(info.targetRect).toBeNull();
  expect(info.side).toBe("over");
});

test("a step with a target reports the target's rect", async ({ page }) => {
  await highlight(page, { element: "#intro", popover: { title: "Rect", side: "bottom" } });

  const info = await lastInfo(page);
  const target = await box(page.locator("#intro"));
  expect(info.targetRect).not.toBeNull();
  expect(Math.abs(info.targetRect!.x - target.x)).toBeLessThan(1);
  expect(Math.abs(info.targetRect!.y - target.y)).toBeLessThan(1);
  expect(Math.abs(info.targetRect!.width - target.width)).toBeLessThan(1);
});

test("side over on a real element keeps the target rect while the popover is centered", async ({ page }) => {
  await highlight(page, { element: "#intro", popover: { title: "Rect", side: "over" } });

  const info = await lastInfo(page);
  expect(info.side).toBe("over");
  expect(info.targetRect).not.toBeNull();
  expect(info.targetRect!.width).toBeGreaterThan(0);
  await expect(page.locator("#intro")).toHaveAttribute("data-vt-target");
  const pop = await box(popover(page));
  const size = page.viewportSize()!;
  expect(Math.abs(pop.x + pop.width / 2 - size.width / 2)).toBeLessThan(2);
});
