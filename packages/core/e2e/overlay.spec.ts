import { expect, test, type Page } from "@playwright/test";
import type { TourConfig } from "../src/index";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const popover = (page: Page) => page.locator(".vt-popover");
const overlayPath = (page: Page) => page.locator(".vt-overlay path");
const count = (page: Page, id: string) => page.evaluate((id) => Number(document.getElementById(id)!.dataset["count"]), id);
const running = (page: Page) => page.evaluate(() => window.vtTour.isRunning());
const settle = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

const BASE: TourConfig = { animate: false, stepDefaults: { placement: { side: "bottom" } } };

async function open(page: Page, config: TourConfig) {
  await page.goto("/fixtures/overlay.html");
  await page.locator("html[data-ready=true]").waitFor();
  const payload: object = { ...BASE, stepDefaults: { ...BASE.stepDefaults, ...config.stepDefaults }, ...config };
  await page.evaluate((payload) => {
    window.vtLog.length = 0;
    const tour = window.vt.createTour(payload as TourConfig);
    tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));
    window.vtTour = tour;
    void tour.start();
  }, payload);
  await expect.poll(() => page.evaluate(() => window.vtLog.length)).toBeGreaterThan(0);
  await settle(page);
}

const center = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
};

const hit = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (!element) return { id: "none", overlay: false, tag: "none" };
      return { id: element.id, overlay: !!element.closest(".vt-overlay"), tag: element.tagName.toLowerCase() };
    },
    { x, y },
  );

const subpaths = async (page: Page) => (await overlayPath(page).getAttribute("d"))!.split("M").length - 1;

const DIMMED = { x: 640, y: 420 };

test("(a) a click inside the cut-out reaches the target", async ({ page }) => {
  await open(page, { dim: true, steps: [{ id: "one", title: "One", target: "#t1" }] });
  await page.locator("#t1").click();
  expect(await count(page, "t1")).toBe(1);
  const point = await center(page, "#t1");
  const top = await hit(page, point.x, point.y);
  expect(top.id).toBe("t1");
});

test("(b) a click in the dimmed area does not reach the page and clickOutside none keeps the tour open", async ({ page }) => {
  await open(page, { dim: { clickOutside: "none" }, steps: [{ id: "one", title: "One", target: "#t1" }] });
  const top = await hit(page, DIMMED.x, DIMMED.y);
  expect(top.overlay).toBe(true);
  expect(top.tag).toBe("path");
  await page.locator("#outside").click({ force: true, position: { x: 5, y: 5 } });
  expect(await count(page, "outside")).toBe(0);
  await page.mouse.click(DIMMED.x, DIMMED.y);
  await settle(page);
  expect(await running(page)).toBe(true);
  await expect(popover(page)).toBeVisible();
});

test("(b) clickOutside exit closes the tour and clickOutside forward moves on", async ({ page }) => {
  await open(page, { dim: { clickOutside: "exit" }, steps: [{ id: "one", title: "One", target: "#t1" }] });
  await page.mouse.click(DIMMED.x, DIMMED.y);
  await expect.poll(() => running(page)).toBe(false);
  expect(await count(page, "outside")).toBe(0);

  await open(page, {
    dim: { clickOutside: "forward" },
    steps: [
      { id: "one", title: "One", target: "#t1" },
      { id: "two", title: "Two", target: "#t2" },
    ],
  });
  await page.mouse.click(DIMMED.x, DIMMED.y);
  await expect.poll(() => page.evaluate(() => window.vtLog.includes("shown:two"))).toBe(true);
});

test("(c) the overlay path opacity equals dim.opacity and the color matches", async ({ page }) => {
  await open(page, { dim: { opacity: 0.35, color: "rgb(10, 20, 30)" }, steps: [{ id: "one", title: "One", target: "#t1" }] });
  const style = await overlayPath(page).evaluate((path) => {
    const computed = getComputedStyle(path);
    return { opacity: Number(computed.opacity), fill: computed.fill };
  });
  expect(style.opacity).toBeCloseTo(0.35, 5);
  expect(style.fill).toBe("rgb(10, 20, 30)");
});

test("(d) targetInteractive false blocks the click and the target is not under its own center", async ({ page }) => {
  await open(page, {
    dim: true,
    steps: [{ id: "one", title: "One", target: "#t1", spotlight: { targetInteractive: false } }],
  });
  const point = await center(page, "#t1");
  await page.mouse.click(point.x, point.y);
  expect(await count(page, "t1")).toBe(0);
  const top = await hit(page, point.x, point.y);
  expect(top.id).not.toBe("t1");
});

test("(d) targetInteractive false also blocks the click with dim false", async ({ page }) => {
  await open(page, {
    dim: false,
    steps: [{ id: "one", title: "One", target: "#t1", spotlight: { targetInteractive: false } }],
  });
  const point = await center(page, "#t1");
  await page.mouse.click(point.x, point.y);
  expect(await count(page, "t1")).toBe(0);
  const top = await hit(page, point.x, point.y);
  expect(top.id).not.toBe("t1");
});

test("(d) targetInteractive hover-only blocks the click with dim false", async ({ page }) => {
  await open(page, {
    dim: false,
    steps: [{ id: "one", title: "One", target: "#t1", spotlight: { targetInteractive: "hover-only" } }],
  });
  const point = await center(page, "#t1");
  await page.mouse.click(point.x, point.y);
  expect(await count(page, "t1")).toBe(0);
});

test("(e) two extras stay clickable while dimmed and the overlay is transparent over them", async ({ page }) => {
  await open(page, { dim: true, steps: [{ id: "one", title: "One", target: "#t1", spotlight: { extra: ["#x1", "#x2"] } }] });
  for (const id of ["x1", "x2"]) {
    const point = await center(page, `#${id}`);
    const top = await hit(page, point.x, point.y);
    expect(top.id).toBe(id);
    expect(top.overlay).toBe(false);
    await page.mouse.click(point.x, point.y);
    expect(await count(page, id)).toBe(1);
  }
  expect((await hit(page, DIMMED.x, DIMMED.y)).overlay).toBe(true);
});

test("(f) nested extras produce one hole", async ({ page }) => {
  await open(page, { dim: true, steps: [{ id: "one", title: "One", target: "#t1", spotlight: { extra: ["#nest"] } }] });
  const single = await subpaths(page);
  await open(page, { dim: true, steps: [{ id: "one", title: "One", target: "#t1", spotlight: { extra: ["#nest", "#nest-inner", ".nest"] } }] });
  expect(await subpaths(page)).toBe(single);
  expect(single).toBe(3);
  const inner = await center(page, "#nest-inner");
  expect((await hit(page, inner.x, inner.y)).id).toBe("nest-inner");
});

test("(g) reduced motion jumps the cut-out and uses vt-simple instead of vt-fade", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, {
    animate: true,
    dim: { transitionMs: 3000, padding: 0, radius: 0 },
    steps: [
      { id: "one", title: "One", target: "#t1" },
      { id: "two", title: "Two", target: "#t2" },
    ],
  });
  expect(await page.evaluate(() => document.body.classList.contains("vt-simple"))).toBe(true);
  expect(await page.evaluate(() => document.body.classList.contains("vt-fade"))).toBe(false);
  const d = await page.evaluate(async () => {
    await window.vtTour.forward();
    return document.querySelector(".vt-overlay path")!.getAttribute("d");
  });
  await settle(page);
  await page.waitForTimeout(300);
  expect(await overlayPath(page).getAttribute("d")).toBe(d);
  const to = await page.locator("#t2").boundingBox();
  expect(d).toContain(`M${to!.x},${to!.y}`);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("(h) dim false leaves a page button outside the tour clickable and draws no overlay", async ({ page }) => {
  await open(page, { dim: false, steps: [{ id: "one", title: "One", target: "#t1", spotlight: { class: "marked" } }] });
  await expect(page.locator(".vt-overlay")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.hasAttribute("data-vt-dim"))).toBe(false);
  await page.locator("#outside").click();
  expect(await count(page, "outside")).toBe(1);
  expect(await running(page)).toBe(true);
  await expect(page.locator("#t1")).toHaveClass(/vt-spotlit/);
  await expect(page.locator("#t1")).toHaveClass(/marked/);
  await expect(page.locator("#t1")).toHaveAttribute("data-vt-target", "");
  await expect(popover(page)).toBeVisible();
});

test("(i) the half-visible list item's cut-out is the visible part and extends past the scroller with clipToScrollParents false", async ({ page }) => {
  const config = (clip: boolean): TourConfig => ({
    dim: { padding: 0, radius: 0, clipToScrollParents: clip },
    stepDefaults: { reveal: false, placement: { side: "right" } },
    steps: [{ id: "one", title: "One", target: "#li-3" }],
  });
  await open(page, config(true));
  const scroller = (await page.locator("#scroller").boundingBox())!;
  const item = (await page.locator("#li-3").boundingBox())!;
  expect(item.y + item.height).toBeGreaterThan(scroller.y + scroller.height);
  const clipped = await page.evaluate(() => document.querySelector(".vt-overlay path")!.getAttribute("d")!.split("Z")[1]!);
  const bottom = (d: string) => {
    const y = Number(/M[\d.-]+,([\d.-]+)/.exec(d)![1]);
    const v = Number(/v([\d.-]+)/.exec(d)![1]);
    return y + v;
  };
  expect(Math.abs(bottom(clipped) - (scroller.y + scroller.height))).toBeLessThan(2);
  expect(Math.abs(Number(/M([\d.-]+),/.exec(clipped)![1]) - item.x)).toBeLessThan(2);

  await open(page, config(false));
  const unclipped = await page.evaluate(() => document.querySelector(".vt-overlay path")!.getAttribute("d")!.split("Z")[1]!);
  expect(Math.abs(bottom(unclipped) - (item.y + item.height))).toBeLessThan(2);
  expect(bottom(unclipped)).toBeGreaterThan(scroller.y + scroller.height + 5);
});

test("(j) per-corner radius renders at two corners", async ({ page }) => {
  await open(page, {
    dim: { padding: 0, radius: { topLeft: 16, bottomRight: 12, topRight: 0, bottomLeft: 0 } },
    steps: [{ id: "one", title: "One", target: "#t1" }],
  });
  const d = (await overlayPath(page).getAttribute("d"))!.split("Z")[1]!;
  expect(d).toContain("a16,16 0 0 1 16,-16");
  expect(d).toContain("a12,12 0 0 1 -12,12");
  expect(d).toContain("a0,0 0 0 1 0,0");
  const box = (await page.locator("#t1").boundingBox())!;
  const probe = (x: number, y: number) => hit(page, x, y);
  expect((await probe(box.x + 1, box.y + 1)).overlay).toBe(true);
  expect((await probe(box.x + box.width - 1, box.y + 1)).overlay).toBe(false);
  expect((await probe(box.x + box.width - 1, box.y + box.height - 1)).overlay).toBe(true);
  expect((await probe(box.x + 1, box.y + box.height - 1)).overlay).toBe(false);
});

test("(k) screenshot of the dimmed page with a cut-out and extras", async ({ page }, testInfo) => {
  await open(page, {
    dim: { padding: 8, radius: 10 },
    steps: [{ id: "one", title: "One", body: "The target and two extras are lit.", target: "#t1", spotlight: { extra: ["#x1", "#x2"] } }],
  });
  const body = await page.screenshot();
  await testInfo.attach("overlay", { body, contentType: "image/png" });
  expect(body.byteLength).toBeGreaterThan(1000);
});

test("state classes follow the step and a shared element keeps its class between steps", async ({ page }) => {
  await open(page, {
    dim: true,
    steps: [
      { id: "one", title: "One", target: "#t1", spotlight: { extra: ["#x1"] } },
      { id: "two", title: "Two", target: "#t2", spotlight: { extra: ["#x1"] } },
    ],
  });
  await expect(page.locator("#t1")).toHaveClass(/vt-spotlit/);
  await expect(page.locator("#x1")).toHaveClass(/vt-spotlit/);
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { classLog: string[] }).classLog = log;
    new MutationObserver((records) => {
      for (const r of records) log.push(`${r.oldValue}`);
    }).observe(document.getElementById("x1")!, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  });
  await page.evaluate(() => window.vtTour.forward());
  await settle(page);
  await expect(page.locator("#t1")).not.toHaveClass(/vt-spotlit/);
  await expect(page.locator("#t2")).toHaveClass(/vt-spotlit/);
  await expect(page.locator("#x1")).toHaveClass(/vt-spotlit/);
  const spotlitFlips = await page.evaluate(() => (window as unknown as { classLog: string[] }).classLog.filter((old) => !/vt-spotlit/.test(old)));
  expect(spotlitFlips).toEqual([]);
  await page.evaluate(() => window.vtTour.exit());
  await expect(page.locator("#t2")).not.toHaveClass(/vt-spotlit/);
  await expect(page.locator("#x1")).not.toHaveClass(/vt-spotlit/);
});
