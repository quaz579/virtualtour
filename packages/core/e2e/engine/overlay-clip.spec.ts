import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, near, openFixture, overlay, settle } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

type ClipConfig = { clipStageToScrollParents?: boolean; stagePadding?: number };

const holeHeight = (page: Page) =>
  page.locator(".vt-overlay path").evaluate(element => {
    const d = element.getAttribute("d")!;
    const match = d.split("Z")[1].match(/M\S+ h\S+ a(\S+),\S+ 0 0 1 \S+ v(\S+) /)!;

    return Number(match[2]) + Number(match[1]) * 2;
  });

async function highlight(page: Page, config: ClipConfig = {}) {
  await page.evaluate(config => {
    window.tour?.destroy();
    window.tour = window.__engine.createEngine({ animate: false, stagePadding: 0, stageRadius: 0, ...config });
    window.tour.highlight({ element: "#clip-3", popover: { title: "Third" } });
  }, config);
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
}

async function scrollList(page: Page, top: number) {
  await page.locator("#clip-list").evaluate((element, top) => {
    element.scrollTop = top;
  }, top);
  await page.evaluate(() => window.tour.refresh());
  await settle(page);
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#clip-list")!.style.display = "block";
  });
});

test.describe("scroll container clipping", () => {
  test("cuts out only the visible half of the third item", async ({ page }) => {
    await highlight(page);
    await scrollList(page, 0);
    near(await holeHeight(page), 40);
  });

  test("restores the full item with clipStageToScrollParents off", async ({ page }) => {
    await highlight(page, { clipStageToScrollParents: false });
    await scrollList(page, 0);
    near(await holeHeight(page), 80);
  });

  test("keeps the padded hole inside the scroll container", async ({ page }) => {
    await highlight(page, { stagePadding: 10 });
    await scrollList(page, 0);
    near(await holeHeight(page), 50);
  });

  test("follows the scroll container after refresh", async ({ page }) => {
    await highlight(page);
    await scrollList(page, 0);
    near(await holeHeight(page), 40);

    await scrollList(page, 50);
    near(await holeHeight(page), 80);

    await scrollList(page, 0);
    near(await holeHeight(page), 40);
  });
});
