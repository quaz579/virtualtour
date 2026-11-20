import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Win = { vtTour: { start(): Promise<void>; forward(): Promise<void>; backward(): Promise<void>; nudge(message?: string): void; hideCurrent(): void } };

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`/fixtures/motion.html${query}`);
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.evaluate(() => (window as unknown as { vtTour: { start(): Promise<void> } }).vtTour.start());
  await expect(page.locator(".vt-popover-title")).toHaveText("One");
}

const rect = (page: Page) => page.locator(".vt-popover").evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width };
});

test("the popover is between the two positions part way through a glide and lands on the computed one", async ({ page }) => {
  await open(page, "?duration=600");
  const first = await rect(page);
  const mid = await page.evaluate(async () => {
    const w = window as unknown as Win;
    const pending = w.vtTour.forward();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const el = document.querySelector<HTMLElement>(".vt-popover")!;
    const r = el.getBoundingClientRect();
    await pending;
    return { left: r.left, top: r.top, glide: el.classList.contains("vt-glide"), title: el.querySelector(".vt-popover-title")?.textContent };
  });
  await expect(page.locator(".vt-popover-title")).toHaveText("Two");
  await expect.poll(() => page.locator(".vt-popover").evaluate((el) => el.getAnimations().length)).toBe(0);
  const settledState = await page.locator(".vt-popover").evaluate((el) => ({
    animations: el.getAnimations().length,
    opacity: getComputedStyle(el).opacity,
  }));
  expect(settledState).toEqual({ animations: 0, opacity: "1" });
  const last = await rect(page);
  const between = (v: number, a: number, b: number): boolean => v > Math.min(a, b) + 1 && v < Math.max(a, b) - 1;
  expect(mid.glide).toBe(true);
  expect(between(mid.left, first.left, last.left)).toBe(true);
  expect(between(mid.top, first.top, last.top)).toBe(true);
  expect(last.left).toBeGreaterThan(first.left + 100);
  const computed = await page.locator(".vt-popover").evaluate((el) => {
    const style = getComputedStyle(el);
    return { left: Number.parseFloat(style.left), top: Number.parseFloat(style.top), transform: style.transform };
  });
  expect(Math.abs(last.left - computed.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(last.top - computed.top)).toBeLessThanOrEqual(1);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(computed.transform);
});

test("without glide the new popover is at its final position immediately", async ({ page }) => {
  await open(page, "?noglide=1&duration=600");
  const sample = await page.evaluate(async () => {
    const w = window as unknown as Win;
    await w.vtTour.forward();
    const el = document.querySelector<HTMLElement>(".vt-popover")!;
    const a = el.getBoundingClientRect();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const b = el.getBoundingClientRect();
    return { a: a.left, b: b.left, glide: el.classList.contains("vt-glide") };
  });
  expect(sample.glide).toBe(false);
  expect(sample.a).toBeCloseTo(sample.b, 0);
});

test("reduced motion puts the popover at its final position right away", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "?duration=600");
  const sample = await page.evaluate(async () => {
    const w = window as unknown as Win;
    await w.vtTour.forward();
    const el = document.querySelector<HTMLElement>(".vt-popover")!;
    const a = el.getBoundingClientRect();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const b = el.getBoundingClientRect();
    return { a: a.left, b: b.left, glide: el.classList.contains("vt-glide"), animations: el.getAnimations().length };
  });
  expect(sample.glide).toBe(false);
  expect(sample.animations).toBe(0);
  expect(sample.a).toBeCloseTo(sample.b, 0);
});

test("the progress bar is index over total of the popover width on every step", async ({ page }) => {
  await open(page, "?animate=0");
  for (const [index, name] of [[1, "One"], [2, "Two"], [3, "Three"]] as const) {
    if (index > 1) await page.evaluate(() => (window as unknown as Win).vtTour.forward());
    await expect(page.locator(".vt-popover-title")).toHaveText(name);
    const widths = await page.locator(".vt-popover").evaluate((el) => ({
      wrapper: el.getBoundingClientRect().width,
      bar: Number.parseFloat(getComputedStyle(el, "::after").width),
      vars: [el.style.getPropertyValue("--vt-progress-index"), el.style.getPropertyValue("--vt-progress-total")],
    }));
    expect(widths.vars).toEqual([String(index), "3"]);
    expect(Math.abs(widths.bar - (widths.wrapper * index) / 3)).toBeLessThanOrEqual(1);
  }
});

test("the cookbook counter renders the right text from step-shown and progressInfo", async ({ page }) => {
  await open(page, "?animate=0");
  await expect(page.locator("#counter")).toHaveText("1/3");
  await page.evaluate(() => (window as unknown as Win).vtTour.forward());
  await expect(page.locator("#counter")).toHaveText("2/3");
  await expect(page.locator(".vt-popover-progress-text")).toHaveText("Step 2 of 3");
});

async function sampleOpacity(page: Page, run: () => Promise<void>, ms: number, minFrames = 0): Promise<number[]> {
  const pending = page.evaluate(async ({ span, minFrames }) => {
    const out: number[] = [];
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        const el = document.querySelector<HTMLElement>(".vt-popover");
        if (el) out.push(Number(getComputedStyle(el).opacity));
        if (performance.now() - t0 < span || out.length < minFrames) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return out;
  }, { span: ms, minFrames });
  await run();
  return pending;
}

test("the popover never dips in opacity through a glide and after it ends", async ({ page }) => {
  await open(page, "?duration=300");
  await page.waitForTimeout(800);
  const samples = await sampleOpacity(page, () => page.evaluate(() => (window as unknown as Win).vtTour.forward()), 1200, 21);
  expect(samples.length).toBeGreaterThan(20);
  expect(Math.min(...samples.slice(2))).toBe(1);
});

test("a nudge after a glide animates exactly as it does without the add-on", async ({ page }) => {
  const nudged = async (query: string): Promise<number[]> => {
    await open(page, query);
    await page.evaluate(() => (window as unknown as Win).vtTour.forward());
    await page.waitForTimeout(1000);
    return sampleOpacity(page, () => page.evaluate(() => (window as unknown as Win).vtTour.nudge("again")), 700);
  };
  const withGlide = await nudged("?duration=300");
  const without = await nudged("?duration=300&noglide=1");
  expect(Math.min(...withGlide)).toBe(Math.min(...without));
});

test("showing a step after hideCurrent does not glide from the page corner", async ({ page }) => {
  await open(page, "?duration=600");
  const result = await page.evaluate(async () => {
    const w = window as unknown as Win;
    w.vtTour.hideCurrent();
    const pending = w.vtTour.forward();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const el = document.querySelector<HTMLElement>(".vt-popover");
    const glided = el?.classList.contains("vt-glide") ?? false;
    await pending;
    return glided;
  });
  expect(result).toBe(false);
});

type Frame = { title: string | null; left: number; top: number; opacity: number; shown: boolean };

async function frames(page: Page, act: (w: Win) => Promise<void>, settleMs = 1100): Promise<Frame[]> {
  return page.evaluate(
    async ({ body, settleMs }) => {
      const out: Frame[] = [];
      let run = true;
      const tick = (): void => {
        const el = document.querySelector<HTMLElement>(".vt-popover");
        if (el) {
          const style = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          out.push({
            title: el.querySelector(".vt-popover-title")?.textContent ?? null,
            left: r.left,
            top: r.top,
            opacity: Number(style.opacity),
            shown: style.display !== "none" && style.visibility !== "hidden",
          });
        }
        if (run) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      await new Function("w", `return (${body})(w)`)(window);
      await new Promise((resolve) => setTimeout(resolve, settleMs));
      run = false;
      return out;
    },
    { body: act.toString(), settleMs },
  );
}

const visible = (all: Frame[], title: string): Frame[] => all.filter((f) => f.title === title && f.shown && f.opacity > 0.02);

for (const dim of [false, true]) {
  test(`${dim ? "with" : "without"} a dimmed overlay the first visible frame of the next popover is where the previous one was`, async ({ page }) => {
    await open(page, `?duration=400${dim ? "&dim=1" : ""}`);
    await page.waitForTimeout(600);
    const from = await rect(page);
    const all = await frames(page, (w) => w.vtTour.forward());
    const last = await rect(page);
    const seen = visible(all, "Two");
    expect(seen.length).toBeGreaterThan(5);
    const first = seen[0]!;
    expect(first.opacity).toBe(1);
    expect(Math.abs(first.left - from.left)).toBeLessThan(Math.abs(first.left - last.left));
    expect(Math.abs(first.top - from.top)).toBeLessThan(Math.abs(first.top - last.top));
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]!.left).toBeGreaterThanOrEqual(seen[i - 1]!.left - 1);
      expect(seen[i]!.top).toBeGreaterThanOrEqual(seen[i - 1]!.top - 1);
    }
    expect(Math.abs(seen[seen.length - 1]!.left - last.left)).toBeLessThanOrEqual(1);
  });

  test(`${dim ? "with" : "without"} a dimmed overlay under reduced motion the next popover first shows at its final position`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, `?duration=400${dim ? "&dim=1" : ""}`);
    await page.waitForTimeout(300);
    const all = await frames(page, (w) => w.vtTour.forward(), 600);
    const last = await rect(page);
    const seen = visible(all, "Two");
    expect(seen.length).toBeGreaterThan(0);
    for (const f of seen) {
      expect(Math.abs(f.left - last.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(f.top - last.top)).toBeLessThanOrEqual(1);
    }
  });
}

for (const dim of [false, true]) {
  test(`${dim ? "with" : "without"} a dimmed overlay the first popover is never visible away from its final position`, async ({ page }) => {
    await page.goto(`/fixtures/motion.html${dim ? "?dim=1" : ""}`);
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
    const all = await frames(page, (w) => (w.vtTour as unknown as { start(): Promise<void> }).start(), 700);
    const last = await rect(page);
    const seen = visible(all, "One");
    expect(seen.length).toBeGreaterThan(0);
    for (const f of seen) {
      expect(Math.abs(f.left - last.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(f.top - last.top)).toBeLessThanOrEqual(5);
    }
  });
}
