import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, activeIndex, box, closeButton, near, openFixture, popover, settle, title } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

type Dir = "ltr" | "rtl";

const FIXTURES: Record<Dir, string> = { ltr: "/e2e.html", rtl: "/e2e-rtl.html" };
const DIRS: Dir[] = ["ltr", "rtl"];

type Setup = { side?: string; align?: string; cross?: number; strategy?: "fixed" | "absolute"; container?: boolean };

async function show(page: Page, { side = "bottom", align = "start", cross, strategy, container }: Setup = {}) {
  await page.evaluate(
    ({ side, align, cross, strategy, container }) => {
      const app = document.querySelector<HTMLElement>("#app")!;
      if (container) {
        app.style.cssText = "transform:translateZ(0);position:relative;margin-top:400px;height:50px";
      }
      window.tour?.destroy();
      window.tour = window.__engine.createEngine({
        animate: false,
        stagePadding: 0,
        popoverOffset: 0,
        ...(container ? { mountIn: () => app } : {}),
      });
      window.tour.highlight({
        element: "#one",
        ...(cross === undefined ? {} : { popoverCrossOffset: cross }),
        popover: {
          title: "RTL",
          description: "Placed",
          showButtons: ["next", "previous", "close"],
          side: side as "bottom",
          align: align as "start",
          flip: false,
          shift: false,
          ...(strategy ? { strategy } : {}),
        },
      });
    },
    { side, align, cross, strategy, container }
  );
  await expect(title(page)).toHaveText("RTL");
  await settle(page);
}

for (const dir of DIRS) {
  test.describe(dir, () => {
    test.beforeEach(async ({ page }) => {
      await openFixture(page, FIXTURES[dir]);
    });

    test("the document direction is set", async ({ page }) => {
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe(dir);
    });

    test("start aligns the inline-start edges", async ({ page }) => {
      await show(page, { align: "start" });
      const target = await box(page.locator("#one"));
      const pop = await box(popover(page));

      if (dir === "ltr") {
        near(pop.x, target.x);
      } else {
        near(pop.x + pop.width, target.x + target.width);
      }
    });

    test("end aligns the inline-end edges", async ({ page }) => {
      await show(page, { align: "end" });
      const target = await box(page.locator("#one"));
      const pop = await box(popover(page));

      if (dir === "ltr") {
        near(pop.x + pop.width, target.x + target.width);
      } else {
        near(pop.x, target.x);
      }
    });

    test("center does not depend on direction", async ({ page }) => {
      await show(page, { align: "center" });
      const target = await box(page.locator("#one"));
      const pop = await box(popover(page));

      near(pop.x + pop.width / 2, target.x + target.width / 2);
    });

    test("the close button sits in the inline-end corner", async ({ page }) => {
      await show(page);
      const pop = await box(popover(page));
      const close = await box(closeButton(page));

      if (dir === "ltr") {
        expect(pop.x + pop.width - (close.x + close.width)).toBeLessThan(8);
        expect(close.x - pop.x).toBeGreaterThan(pop.width / 2);
      } else {
        expect(close.x - pop.x).toBeLessThan(8);
        expect(close.x + close.width - pop.x).toBeLessThan(pop.width / 2);
      }
      expect(close.y - pop.y).toBeLessThan(8);
      await expect(popover(page)).toHaveClass(dir === "rtl" ? /vt-popover-rtl/ : /^(?!.*vt-popover-rtl)/);
    });

    test("cross offset moves toward inline-end", async ({ page }) => {
      await show(page, { align: "start", cross: 20 });
      const target = await box(page.locator("#one"));
      const pop = await box(popover(page));

      if (dir === "ltr") {
        near(pop.x, target.x + 20);
      } else {
        near(pop.x + pop.width, target.x + target.width - 20);
      }
    });

    test("negative cross offset moves toward inline-start", async ({ page }) => {
      await show(page, { align: "start", cross: -20 });
      const target = await box(page.locator("#one"));
      const pop = await box(popover(page));

      if (dir === "ltr") {
        near(pop.x, target.x - 20);
      } else {
        near(pop.x + pop.width, target.x + target.width + 20);
      }
    });

    test("cross offset on a left side moves down in both directions", async ({ page }) => {
      await show(page, { side: "left", align: "start", cross: 20 });
      const target = await box(page.locator("#one"));
      const pop = await box(popover(page));

      near(pop.y, target.y + 20);
    });

    test("absolute strategy with cross offset stays mirrored", async ({ page }) => {
      await show(page, { align: "start", cross: 20, strategy: "absolute", container: true });
      const target = await box(page.locator("#one"));
      const pop = await box(popover(page));

      if (dir === "ltr") {
        near(pop.x, target.x + 20);
      } else {
        near(pop.x + pop.width, target.x + target.width - 20);
      }
      near(pop.y, target.y + target.height);
      await expect(popover(page)).toHaveAttribute("data-vt-strategy", "absolute");
    });

    test("ArrowRight goes forward and ArrowLeft goes back", async ({ page }) => {
      await page.evaluate(() => {
        window.tour?.destroy();
        window.tour = window.__engine.createEngine({
          animate: false,
          steps: [
            { element: "#one", popover: { title: "One" } },
            { element: "#two", popover: { title: "Two" } },
          ],
        });
        window.tour.drive(0);
      });
      await expect(title(page)).toHaveText("One");
      await settle(page);

      await page.keyboard.press("ArrowRight");
      await expect(title(page)).toHaveText("Two");
      expect(await activeIndex(page)).toBe(1);

      await page.keyboard.press("ArrowLeft");
      await expect(title(page)).toHaveText("One");
      expect(await activeIndex(page)).toBe(0);
    });
  });
}

test("side fallback mirrors", async ({ page }) => {
  const sides: Record<Dir, string> = { ltr: "", rtl: "" };
  for (const dir of DIRS) {
    await openFixture(page, FIXTURES[dir]);
    sides[dir] = await page.evaluate(() => {
      const infos: string[] = [];
      window.tour?.destroy();
      window.tour = window.__engine.createEngine({
        animate: false,
        onReposition: info => infos.push(info.side),
      });
      const target = document.querySelector<HTMLElement>("#one")!;
      target.style.cssText = "position:fixed;top:4px;left:50%";
      window.tour.highlight({ element: "#one", popover: { title: "Fallback", side: "top" } });
      return infos.at(-1)!;
    });
  }

  expect(sides.ltr).toBe("left");
  expect(sides.rtl).toBe("right");
});

test("side auto breaks a left and right free space tie by direction", async ({ page }) => {
  const sides: Record<Dir, string> = { ltr: "", rtl: "" };
  for (const dir of DIRS) {
    await openFixture(page, FIXTURES[dir]);
    sides[dir] = await page.evaluate(() => {
      const infos: string[] = [];
      window.tour?.destroy();
      window.tour = window.__engine.createEngine({
        animate: false,
        stagePadding: 0,
        onReposition: info => infos.push(info.side),
      });
      const target = document.querySelector<HTMLElement>("#one")!;
      const left = (window.innerWidth - 100) / 2;
      target.style.cssText = `position:fixed;top:150px;left:${left}px;width:100px;height:${window.innerHeight - 300}px`;
      window.tour.highlight({ element: "#one", popover: { title: "Auto", side: "auto" } });
      return infos.at(-1)!;
    });
  }

  expect(sides.ltr).toBe("right");
  expect(sides.rtl).toBe("left");
});
