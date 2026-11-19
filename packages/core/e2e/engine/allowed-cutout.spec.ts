import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, box, openFixture, overlay, settle, topElementAt } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

async function start(page: Page, allowedElements: string | string[]) {
  await page.evaluate(allowed => {
    window.tour?.destroy();
    window.tour = window.__engine.createEngine({ animate: false, overlayClickBehavior: "none", stagePadding: 0, stageRadius: 0 });
    window.tour.highlight({ element: "#heading", allowedElements: allowed, popover: { title: "Heading" } });
    (window as unknown as { clicks: number }).clicks = 0;
    document.querySelector("#outside")!.addEventListener("click", () => ((window as unknown as { clicks: number }).clicks += 1));
  }, allowedElements);
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
}

const pathData = (page: Page) => page.locator(".vt-overlay path").evaluate(element => element.getAttribute("d")!);

const subpaths = async (page: Page) => (await pathData(page)).split("M").length - 1;

async function luminance(page: Page, x: number, y: number) {
  const png = (await page.screenshot()).toString("base64");

  return page.evaluate(
    async ({ png, x, y }) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      const [r, g, b] = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;

      return r + g + b;
    },
    { png, x, y }
  );
}

test.describe("allowed element cut-outs outside a dialog", () => {
  test.beforeEach(async ({ page }) => {
    await openFixture(page);
  });

  test("the overlay is transparent over an allowed button and clicks reach it", async ({ page }) => {
    await start(page, "#outside");
    const rect = await box(page.locator("#outside"));
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;

    expect(await topElementAt(page, x, y)).toBe("outside");
    expect(await topElementAt(page, 5, 400)).toBe("overlay");
    await page.mouse.click(x, y);
    expect(await page.evaluate(() => (window as unknown as { clicks: number }).clicks)).toBe(1);
  });

  test("the cut-out is not darkened in the screenshot", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "pixel checks run in chromium");
    await page.addStyleTag({ content: "#outside { background: #fff; border: 0; }" });
    await start(page, "#outside");
    const rect = await box(page.locator("#outside"));

    const inside = await luminance(page, rect.x + 3, rect.y + 3);
    const dimmed = await luminance(page, 5, 400);
    expect(inside).toBeGreaterThan(600);
    expect(dimmed).toBeLessThan(300);
  });

  test("without allowed elements the same point is covered by the overlay", async ({ page }) => {
    await start(page, []);
    const rect = await box(page.locator("#outside"));

    expect(await topElementAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2)).toBe("overlay");
    expect(await subpaths(page)).toBe(2);
  });

  test("nested allowed elements and one inside the active element add no extra holes", async ({ page }) => {
    await page.evaluate(() => {
      const inner = document.createElement("span");
      inner.id = "nested";
      inner.textContent = "nested";
      document.querySelector("#outside")!.appendChild(inner);
    });
    await start(page, "#outside");
    const single = await pathData(page);

    await start(page, ["#outside", "#nested", "#heading"]);
    expect(await pathData(page)).toBe(single);
  });

  test("an allowed element added during the step is cut out", async ({ page }) => {
    await start(page, ".late");
    const before = await pathData(page);
    expect(await subpaths(page)).toBe(2);

    await page.evaluate(() => document.querySelector("#outside")!.classList.add("late"));
    await expect.poll(() => pathData(page)).not.toBe(before);
  });
});
