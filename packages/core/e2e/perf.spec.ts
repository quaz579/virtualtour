import { expect, test, type Page } from "@playwright/test";
import { openFixture, settle } from "./engine/harness";

test.skip(({ browserName }) => browserName !== "chromium", "frame timing is only tracked on chromium");

const ROWS = 10_000;
const EXTRAS = 6;

type Counts = { styles: number; rects: number };

async function startTour(page: Page) {
  await page.evaluate(
    ([rows, extras]) => {
      const list = document.createElement("div");
      list.id = "perf-list";
      list.style.cssText = "position:fixed;top:40px;left:40px;width:420px;height:560px;overflow:auto;background:#eef";
      const inner = document.createElement("div");
      inner.id = "perf-inner";
      inner.style.cssText = "position:relative";
      for (let i = 0; i < (rows as number); i++) {
        const row = document.createElement("div");
        row.className = "perf-row";
        row.id = `perf-row-${i}`;
        row.style.height = "24px";
        row.textContent = `Row ${i}`;
        inner.append(row);
      }
      list.append(inner);
      document.body.append(list);
      for (let i = 0; i < (extras as number); i++) {
        const extra = document.createElement("button");
        extra.className = "perf-extra";
        extra.style.cssText = `position:fixed;left:${500 + i * 12}px;top:${60 + i * 30}px;width:${100 - i * 8}px;height:24px`;
        extra.textContent = `x${i}`;
        document.body.append(extra);
      }
      const w = window as unknown as {
        tour?: { destroy(): void; highlight(step: unknown): void };
        __engine: { createEngine(config: unknown): NonNullable<typeof w.tour> };
      };
      w.tour?.destroy();
      w.tour = w.__engine.createEngine({ animate: false });
      w.tour.highlight({
        element: "#perf-row-40",
        allowedElements: ".perf-extra",
        popover: { title: "Row", description: "A row in a long list" },
      });
    },
    [ROWS, EXTRAS]
  );
  await expect(page.locator(".vt-popover")).toBeVisible();
  await settle(page);
}

async function countRefresh(page: Page): Promise<Counts> {
  return page.evaluate(async () => {
    const counts = { styles: 0, rects: 0 };
    const style = window.getComputedStyle;
    const rect = Element.prototype.getBoundingClientRect;
    window.getComputedStyle = function (this: Window, ...args: Parameters<typeof style>) {
      counts.styles += 1;

      return style.apply(this, args);
    };
    Element.prototype.getBoundingClientRect = function (this: Element) {
      counts.rects += 1;

      return rect.call(this);
    };
    (window as unknown as { tour: { refresh(): void } }).tour.refresh();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.getComputedStyle = style;
    Element.prototype.getBoundingClientRect = rect;

    return counts;
  });
}

test("a tour on a 10000-row list keeps frames and the main thread healthy while scrolling", async ({ page }, testInfo) => {
  await openFixture(page);
  await startTour(page);

  const counts = await countRefresh(page);
  testInfo.annotations.push({ type: "per-refresh", description: JSON.stringify(counts) });

  await page.evaluate(() => {
    const w = window as unknown as { __perf: { longTasks: number; frames: number[]; stop: boolean } };
    w.__perf = { longTasks: 0, frames: [], stop: false };
    new PerformanceObserver(list => {
      w.__perf.longTasks += list.getEntries().length;
    }).observe({ entryTypes: ["longtask"] });
    const tick = (time: number) => {
      w.__perf.frames.push(time);
      if (!w.__perf.stop) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });

  await page.mouse.move(200, 300);
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(8);
  }

  const result = await page.evaluate(() => {
    const w = window as unknown as { __perf: { longTasks: number; frames: number[]; stop: boolean } };
    w.__perf.stop = true;
    const { frames, longTasks } = w.__perf;
    const seconds = (frames[frames.length - 1]! - frames[0]!) / 1000;

    return { longTasks, fps: (frames.length - 1) / seconds, scrolled: document.querySelector("#perf-list")!.scrollTop };
  });
  testInfo.annotations.push({ type: "scroll", description: JSON.stringify(result) });
  console.log(`perf ${JSON.stringify({ counts, ...result })}`);

  expect(result.scrolled).toBeGreaterThan(0);
  expect(result.longTasks).toBe(0);
  expect(result.fps).toBeGreaterThan(50);
});
