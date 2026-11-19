import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Win = { vtMotionRun(options?: Record<string, unknown>): Promise<void>; vtMotionAnims: string[]; vtMotionTour: { forward(): Promise<void> } };

const IDLE = ["blink", "wobble", "look"];

async function open(page: Page): Promise<void> {
  await page.goto("/fixtures/avatar-motion.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
}

const run = (page: Page, options: Record<string, unknown> = {}) => page.evaluate((o) => (window as unknown as Win).vtMotionRun(o), options);
const anims = (page: Page) => page.evaluate(() => (window as unknown as Win).vtMotionAnims);
const avatar = (page: Page) => page.locator(".vt-avatar");

test("the idle loop plays an idle animation after the quiet period and returns to rest", async ({ page }) => {
  await open(page);
  await run(page, { idleQuietMs: 300 });
  await expect(avatar(page)).toHaveAttribute("data-vt-anim", "rest");
  await expect.poll(async () => (await anims(page)).some((name) => IDLE.includes(name)), { timeout: 1500 }).toBe(true);
  await expect.poll(async () => (await anims(page)).at(-1), { timeout: 1500 }).toBe("rest");
  const seen = await anims(page);
  expect(seen.every((name) => name === "rest" || IDLE.includes(name))).toBe(true);
});

test("idle:false on the tour keeps the avatar at rest", async ({ page }) => {
  await open(page);
  await run(page, { idleQuietMs: 200, idle: false });
  await page.waitForTimeout(1200);
  expect(new Set(await anims(page))).toEqual(new Set(["rest"]));
});

test("a pending idle never plays after the tour ends", async ({ page }) => {
  await open(page);
  await run(page, { idleQuietMs: 500 });
  await page.evaluate(() => (window as unknown as { vtMotionTour: { finish(): void } }).vtMotionTour.finish());
  await page.waitForTimeout(1000);
  await expect(avatar(page)).toHaveCount(0);
  expect(new Set(await anims(page))).toEqual(new Set(["rest"]));
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the avatar stays at rest with no animations and the overlay jumps between steps", async ({ page }) => {
    await open(page);
    await run(page, { idleQuietMs: 300, animate: true, dim: true });
    await expect(avatar(page)).toHaveAttribute("data-vt-anim", "rest");
    expect(await page.evaluate(() => document.body.classList.contains("vt-simple"))).toBe(true);

    const positions = new Set<string>();
    let animations = 0;
    const end = Date.now() + 1500;
    while (Date.now() < end) {
      const sample = await page.evaluate(() => ({
        pos: document.querySelector<HTMLElement>(".vt-avatar")?.style.backgroundPosition ?? "",
        animations: document.getAnimations().length,
      }));
      positions.add(sample.pos);
      animations = Math.max(animations, sample.animations);
      await page.waitForTimeout(50);
    }
    expect(positions.size).toBe(1);
    expect(animations).toBe(0);
    expect(new Set(await anims(page))).toEqual(new Set(["rest"]));

    const paths = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const seen: string[] = [];
          const read = (): void => {
            const d = document.querySelector(".vt-overlay path")?.getAttribute("d") ?? "";
            if (seen[seen.length - 1] !== d) seen.push(d);
          };
          read();
          const loop = (): void => {
            read();
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
          void (window as unknown as Win).vtMotionTour.forward().then(() => setTimeout(() => resolve(seen), 900));
        }),
    );
    expect(paths.length).toBe(2);
    expect(new Set(await anims(page))).toEqual(new Set(["rest"]));
  });
});

test("with motion on, the overlay tweens through intermediate shapes (control for the jump check)", async ({ page }) => {
  await open(page);
  await run(page, { idleQuietMs: 60000, animate: true, dim: true });
  const paths = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const seen: string[] = [];
        const loop = (): void => {
          const d = document.querySelector(".vt-overlay path")?.getAttribute("d") ?? "";
          if (seen[seen.length - 1] !== d) seen.push(d);
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
        void (window as unknown as Win).vtMotionTour.forward().then(() => setTimeout(() => resolve(seen), 1200));
      }),
  );
  expect(paths.length).toBeGreaterThan(2);
});
