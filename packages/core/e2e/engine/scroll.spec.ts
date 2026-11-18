import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, log, openFixture, overlay, popover, settle, title } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

async function scrollYAfterWheel(page: Page) {
  await page.mouse.wheel(0, 300);

  return scrollY(page);
}

const scroller = (page: Page) => page.locator("#scroller");

const scrollerTop = (page: Page) => scroller(page).evaluate(element => element.scrollTop);

async function addScroller(page: Page) {
  await page.evaluate(() => {
    document.querySelector("#slot")!.innerHTML = `
      <div id="scroller" style="width:300px;height:200px;overflow:auto;border:1px solid #999">
        <div id="first" style="height:40px">First</div>
        <div style="height:110px"></div>
        <div id="middle" style="height:40px">Middle</div>
        <div style="height:400px"></div>
        <div id="last" style="height:40px">Last</div>
        <div id="pinned" style="position:fixed;top:20px;left:600px;width:120px;height:40px">Pinned</div>
      </div>
    `;
  });
}

const isShownInScroller = (page: Page, selector: string) =>
  page.evaluate(selector => {
    const frame = document.querySelector("#scroller")!.getBoundingClientRect();
    const item = document.querySelector(selector)!.getBoundingClientRect();

    return item.top >= frame.top && item.bottom <= frame.bottom;
  }, selector);

async function highlight(page: Page, element: string) {
  await page.evaluate(element => {
    window.tour?.destroy();
    window.tour = window.__engine.createEngine({ animate: false });
    window.tour.highlight({ element, popover: { title: element } });
  }, element);
  await expect(title(page)).toHaveText(element);
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("smoothScroll", () => {
  const scrollToFar = (page: Page, smoothScroll?: boolean) =>
    page.evaluate(smoothScroll => {
      window.tour = window.__engine.createEngine({ animate: false, ...(smoothScroll ? { smoothScroll } : {}) });
      window.tour.highlight({ element: "#far", popover: { title: "Far" } });

      return window.scrollY;
    }, smoothScroll);

  test("is off by default, so the element is in view at once", async ({ page }) => {
    expect(await scrollToFar(page)).toBeGreaterThan(0);
    await expect(page.locator("#far")).toBeInViewport({ ratio: 1 });
  });

  test("glides to the element when it is on", async ({ page }) => {
    expect(await scrollToFar(page, true)).toBe(0);
    await expect(page.locator("#far")).toBeInViewport({ ratio: 1 });
    await expect(popover(page)).toBeInViewport({ ratio: 1 });
  });
});

test.describe("scroll containers", () => {
  test.beforeEach(async ({ page }) => {
    await addScroller(page);
  });

  test("scroll an element they clip into view, though it is inside the viewport", async ({ page }) => {
    expect(await isShownInScroller(page, "#last")).toBe(false);
    await highlight(page, "#last");
    expect(await isShownInScroller(page, "#last")).toBe(true);
    expect(await scrollerTop(page)).toBeGreaterThan(0);

    expect(await isShownInScroller(page, "#first")).toBe(false);
    await highlight(page, "#first");
    expect(await isShownInScroller(page, "#first")).toBe(true);
  });

  test("are left alone for an element they already show, and for a fixed element they do not clip", async ({
    page,
  }) => {
    await scroller(page).evaluate(element => {
      element.scrollTop = 100;
      for (const id of ["middle", "pinned"]) {
        const item = document.getElementById(id)!;
        const scrollIntoView = item.scrollIntoView.bind(item);
        item.scrollIntoView = (...args: Parameters<Element["scrollIntoView"]>) => {
          window.log.push(`scrollIntoView@${id}`);
          scrollIntoView(...args);
        };
      }
    });

    await highlight(page, "#middle");
    await settle(page);
    expect(await scrollerTop(page)).toBe(100);
    expect(await scrollY(page)).toBe(0);

    await highlight(page, "#pinned");
    await settle(page);
    expect(await scrollerTop(page)).toBe(100);
    expect(await log(page)).toEqual([]);
  });

  test("scroll for the next step after the previous step locked them", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({ animate: false, lockScrollParent: true, steps: [{ element: "#first" }, { element: "#last" }] });
      window.tour.drive();
    });
    await expect(scroller(page)).toHaveAttribute("data-vt-lock-scroll");
    await expect(scroller(page)).toHaveCSS("overflow", "hidden");
    expect(await scrollerTop(page)).toBe(0);

    await page.evaluate(() => window.tour.moveNext());
    await expect(page.locator("#last")).toHaveAttribute("data-vt-target");
    expect(await isShownInScroller(page, "#last")).toBe(true);
    expect(await scrollerTop(page)).toBeGreaterThan(0);
  });
});

test.describe("scroll following", () => {
  const rectOf = (page: Page, selector: string) =>
    page.evaluate(selector => {
      const { top, left, width, height } = document.querySelector(selector)!.getBoundingClientRect();

      return { top, left, width, height };
    }, selector);

  const popoverOffset = async (page: Page) => {
    const target = await rectOf(page, "#middle");
    const pop = await rectOf(page, ".vt-popover");

    return { dx: pop.left - target.left, dy: pop.top - target.top };
  };

  const cutout = (page: Page) =>
    page.evaluate(() => {
      const path = document.querySelector(".vt-overlay path")!.getAttribute("d") ?? "";

      return path;
    });

  const start = async (page: Page, lockScrollParent?: boolean) => {
    await addScroller(page);
    await page.evaluate(lockScrollParent => {
      window.tour = window.__engine.createEngine({ animate: false, ...(lockScrollParent ? { lockScrollParent } : {}) });
      window.tour.highlight({ element: "#middle", popover: { title: "Middle", side: "right" } });
    }, lockScrollParent);
    await expect(title(page)).toHaveText("Middle");
  };

  test("moves the popover and cut-out with the target as the scroller scrolls", async ({ page }) => {
    await start(page);
    const initial = await popoverOffset(page);
    let previousCutout = await cutout(page);
    let previousTop = await rectOf(page, "#middle").then(rect => rect.top);

    for (let step = 0; step < 5; step += 1) {
      await scroller(page).evaluate(element => element.scrollBy(0, 20));
      await expect.poll(() => rectOf(page, "#middle").then(rect => rect.top)).toBeLessThan(previousTop);
      previousTop = (await rectOf(page, "#middle")).top;
      await expect.poll(() => cutout(page)).not.toBe(previousCutout);
      previousCutout = await cutout(page);
      await settle(page);

      const offset = await popoverOffset(page);
      expect(Math.abs(offset.dx - initial.dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(offset.dy - initial.dy)).toBeLessThanOrEqual(1);
    }

    expect(await scrollerTop(page)).toBe(100);
  });

  test("follows a wheel over the target as it moves the scroller", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit does not route wheel to a scroller under the dim overlay");
    await start(page);
    const initial = await popoverOffset(page);

    for (let step = 0; step < 5; step += 1) {
      await page.locator("#middle").hover();
      const before = await scrollerTop(page);
      await page.mouse.wheel(0, 20);
      await expect.poll(() => scrollerTop(page)).toBeGreaterThan(before);
      await settle(page);

      const offset = await popoverOffset(page);
      expect(Math.abs(offset.dx - initial.dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(offset.dy - initial.dy)).toBeLessThanOrEqual(1);
    }
  });

  test("lockScrollParent: true keeps the scroller from moving", async ({ page }) => {
    await start(page, true);
    await expect(scroller(page)).toHaveAttribute("data-vt-lock-scroll");
    await expect(scroller(page)).toHaveCSS("overflow", "hidden");

    await page.locator("#middle").hover();
    await page.mouse.wheel(0, 60);
    await settle(page);
    expect(await scrollerTop(page)).toBe(0);
  });

  test("leaves the scroller unlocked by default", async ({ page }) => {
    await start(page);
    await expect(scroller(page)).not.toHaveAttribute("data-vt-lock-scroll");
    await expect(scroller(page)).not.toHaveCSS("overflow", "hidden");
  });
});

test.describe("allowScroll", () => {
  const start = async (page: Page, kind: "highlight" | "tour", allowScroll?: boolean) => {
    await page.evaluate(
      ({ kind, allowScroll }) => {
        const step = { element: "#two", popover: { title: "Two" } };
        window.tour = window.__engine.createEngine({
          animate: false,
          steps: [step],
          ...(allowScroll === false ? { allowScroll } : {}),
        });
        if (kind === "tour") {
          window.tour.drive();
          return;
        }

        window.tour.highlight(step);
      },
      { kind, allowScroll }
    );
    await expect(overlay(page)).toHaveCount(1);
    await page.mouse.move(700, 500);
  };

  test("lets the page scroll under the overlay by default", async ({ page }) => {
    await start(page, "tour");
    await expect(page.locator("body")).not.toHaveClass(/vt-no-scroll/);

    await expect.poll(() => scrollYAfterWheel(page)).toBeGreaterThan(0);
  });

  for (const kind of ["highlight", "tour"] as const) {
    test(`false locks page scrolling for a ${kind} until it is destroyed`, async ({ page }) => {
      await start(page, kind, false);
      await expect(page.locator("body")).toHaveClass(/vt-no-scroll/);

      await page.mouse.wheel(0, 300);
      await settle(page);
      expect(await scrollY(page)).toBe(0);

      await page.evaluate(() => window.tour.destroy());
      await expect(page.locator("body")).not.toHaveClass(/vt-no-scroll/);
      await expect.poll(() => scrollYAfterWheel(page)).toBeGreaterThan(0);
    });
  }
});
