import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Side = "top" | "bottom" | "left" | "right";
type Run = {
  target?: string;
  side?: Side | "over";
  align?: "start" | "center" | "end";
  dock?: "start" | "end" | "auto";
  scale?: number;
  frame?: [number, number];
  dim?: boolean;
  hidden?: boolean;
  namespace?: string;
};
type Win = { vtRun(options?: Run): Promise<void> };
type Box = { x: number; y: number; width: number; height: number };

const SIDES: Side[] = ["bottom", "top", "right", "left"];
const DOCKS = ["end", "start"] as const;

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`/fixtures/avatar-layout.html${query}`);
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
}

const settle = (page: Page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function run(page: Page, options: Run = {}): Promise<void> {
  await page.evaluate((o) => (window as unknown as Win).vtRun(o), options);
  await expect(page.locator(".vt-bubble .vt-popover-title")).toHaveText("Speaker title");
  await settle(page);
  await page.waitForFunction(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 60)));
  await settle(page);
}

async function box(locator: Locator): Promise<Box> {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result as Box;
}

const near = (actual: number, expected: number, tolerance = 1) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const NONE: Box = { x: -1e6, y: -1e6, width: 0, height: 0 };
const boxOrNone = async (locator: Locator): Promise<Box> => ((await locator.count()) === 0 ? NONE : ((await locator.boundingBox()) ?? NONE));

async function parts(page: Page) {
  return {
    wrapper: await box(page.locator(".vt-popover")),
    bubble: await box(page.locator(".vt-bubble")),
    arrow: await boxOrNone(page.locator(".vt-popover-arrow")),
    avatar: await boxOrNone(page.locator(".vt-avatar")),
    description: await box(page.locator(".vt-popover-description")),
    title: await box(page.locator(".vt-popover-title")),
  };
}

async function arrowSide(page: Page): Promise<string> {
  return page.locator(".vt-popover-arrow").evaluate((el) => (el.className.match(/vt-popover-arrow-side-(\w+)/) as RegExpMatchArray)[1] as string);
}

async function expectTailOnBubbleEdge(page: Page, target: string): Promise<void> {
  const { bubble, arrow } = await parts(page);
  const t = await box(page.locator(target));
  const facing = await arrowSide(page);
  if (facing === "bottom") near(arrow.y + arrow.height, bubble.y);
  else if (facing === "top") near(arrow.y, bubble.y + bubble.height);
  else if (facing === "right") near(arrow.x + arrow.width, bubble.x);
  else near(arrow.x, bubble.x + bubble.width);
  if (facing === "bottom" || facing === "top") {
    const center = arrow.x + arrow.width / 2;
    expect(center).toBeGreaterThanOrEqual(bubble.x);
    expect(center).toBeLessThanOrEqual(bubble.x + bubble.width);
    expect(center).toBeGreaterThanOrEqual(t.x - 1);
    expect(center).toBeLessThanOrEqual(t.x + t.width + 1);
  } else {
    const center = arrow.y + arrow.height / 2;
    expect(center).toBeGreaterThanOrEqual(bubble.y);
    expect(center).toBeLessThanOrEqual(bubble.y + bubble.height);
    expect(center).toBeGreaterThanOrEqual(t.y - 1);
    expect(center).toBeLessThanOrEqual(t.y + t.height + 1);
  }
}

async function attach(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

for (const side of SIDES) {
  for (const dock of DOCKS) {
    test(`${side} with dock ${dock}: tail on the bubble's edge, avatar docked and clear of the text`, async ({ page }, testInfo) => {
      await open(page);
      await run(page, { side, dock });
      const p = await parts(page);
      await expect(page.locator(".vt-popover")).toHaveAttribute("data-vt-side", side);
      await expect(page.locator(".vt-popover")).toHaveAttribute("data-vt-dock", dock);
      await expectTailOnBubbleEdge(page, "#center");
      expect(overlaps(p.avatar, p.description)).toBe(false);
      expect(overlaps(p.avatar, p.title)).toBe(false);
      expect(overlaps(p.avatar, p.bubble)).toBe(false);
      if (side === "top" || side === "bottom") {
        if (dock === "end") expect(p.avatar.x).toBeGreaterThanOrEqual(p.bubble.x + p.bubble.width - 1);
        else expect(p.avatar.x + p.avatar.width).toBeLessThanOrEqual(p.bubble.x + 1);
        near(p.avatar.y + p.avatar.height, p.bubble.y + p.bubble.height);
      } else {
        if (dock === "end") expect(p.avatar.y).toBeGreaterThanOrEqual(p.bubble.y + p.bubble.height - 1);
        else expect(p.avatar.y + p.avatar.height).toBeLessThanOrEqual(p.bubble.y + 1);
      }
      if (dock === "end") await attach(page, testInfo, `side-${side}`);
    });
  }
}

async function gapToTarget(page: Page, side: Side): Promise<number> {
  const { bubble } = await parts(page);
  const target = await box(page.locator("#center"));
  if (side === "bottom") return bubble.y - (target.y + target.height);
  if (side === "top") return target.y - (bubble.y + bubble.height);
  if (side === "right") return bubble.x - (target.x + target.width);
  return target.x - (bubble.x + bubble.width);
}

for (const side of SIDES) {
  test(`${side}: an avatar larger than the bubble does not push the bubble or tail away from the target`, async ({ page }) => {
    await open(page);
    const frame: [number, number] = side === "left" || side === "right" ? [360, 24] : [24, 200];
    await run(page, { side, scale: 1, frame, hidden: true });
    const alone = await gapToTarget(page, side);
    await run(page, { side, scale: 1, frame });
    const p = await parts(page);
    const bigger = side === "left" || side === "right" ? p.avatar.width > p.bubble.width : p.avatar.height > p.bubble.height;
    expect(bigger).toBe(true);
    near(await gapToTarget(page, side), alone);
    expect(alone).toBeGreaterThan(0);
    await expectTailOnBubbleEdge(page, "#center");
  });
}

test("the dialog is named by the step title and the avatar is hidden from assistive technology", async ({ page }) => {
  await open(page);
  await run(page);
  await expect(page.getByRole("dialog", { name: "Speaker title" })).toHaveCount(1);
  await expect(page.locator(".vt-avatar")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".vt-avatar-slot")).toHaveCount(1);
  expect(await page.locator(".vt-avatar").evaluate((el) => el.querySelectorAll("button, a, input, [tabindex]").length + Number(el.hasAttribute("tabindex")))).toBe(0);
  const avatar = await box(page.locator(".vt-avatar"));
  near(avatar.width, 96);
  near(avatar.height, 96);
});

for (const where of ["#near-bottom", "#near-right", "#near-left"]) {
  test(`near the boundary (${where}) the whole speaker stays inside the viewport and the tail follows the flip`, async ({ page }) => {
    await open(page);
    await run(page, { target: where, side: where === "#near-bottom" ? "auto" : where === "#near-right" ? "right" : "left", dock: "end" });
    const p = await parts(page);
    const viewport = page.viewportSize() as { width: number; height: number };
    for (const part of [p.wrapper, p.bubble, p.avatar]) {
      expect(part.x).toBeGreaterThanOrEqual(-1);
      expect(part.y).toBeGreaterThanOrEqual(-1);
      expect(part.x + part.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(part.y + part.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await expectTailOnBubbleEdge(page, where);
    const side = await page.locator(".vt-popover").getAttribute("data-vt-side");
    if (where === "#near-bottom") expect(side).toBe("top");
    if (where === "#near-right") expect(side).toBe("left");
    if (where === "#near-left") expect(side).toBe("right");
  });
}

test("when a bottom placement flips beside a target at the bottom edge, dock auto keeps the bubble facing it", async ({ page }) => {
  await open(page);
  await run(page, { target: "#near-bottom", side: "bottom", dock: "auto" });
  const p = await parts(page);
  const viewport = page.viewportSize() as { width: number; height: number };
  const side = await page.locator(".vt-popover").getAttribute("data-vt-side");
  expect(["left", "right"]).toContain(side);
  await expect(page.locator(".vt-popover")).toHaveAttribute("data-vt-dock", "start");
  expect(p.avatar.y + p.avatar.height).toBeLessThanOrEqual(p.bubble.y + 1);
  expect(p.wrapper.y + p.wrapper.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(await arrowSide(page)).toBe(side === "left" ? "left" : "right");
  await expectTailOnBubbleEdge(page, "#near-bottom");
});

test("with a dimmed page the avatar is on top and receives pointer hits", async ({ page }) => {
  await open(page);
  await run(page, { dim: true });
  const { avatar, bubble } = await parts(page);
  const hits = await page.evaluate(
    ({ a, b }) => ({
      avatar: document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2)?.className,
      bubble: document.elementFromPoint(b.x + 3, b.y + 3)?.closest(".vt-bubble") !== null,
    }),
    { a: avatar, b: bubble },
  );
  expect(hits.avatar).toContain("vt-avatar");
  expect(hits.bubble).toBe(true);
});

test("after the page scrolls the tail is still on the bubble's edge", async ({ page }) => {
  await open(page);
  await run(page, { side: "bottom" });
  const before = await parts(page);
  await page.evaluate(() => window.scrollBy(0, 300));
  await settle(page);
  await page.waitForFunction(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 100)));
  const after = await parts(page);
  expect(Math.abs(after.bubble.y - before.bubble.y)).toBeGreaterThan(100);
  await expectTailOnBubbleEdge(page, "#center");
});

for (const dock of DOCKS) {
  test(`right to left with dock ${dock}: the avatar mirrors and the tail stays on the bubble`, async ({ page }) => {
    await open(page, "?rtl");
    await run(page, { side: "bottom", dock });
    const p = await parts(page);
    if (dock === "end") expect(p.avatar.x + p.avatar.width).toBeLessThanOrEqual(p.bubble.x + 1);
    else expect(p.avatar.x).toBeGreaterThanOrEqual(p.bubble.x + p.bubble.width - 1);
    expect(overlaps(p.avatar, p.bubble)).toBe(false);
    await expectTailOnBubbleEdge(page, "#center");
  });
}

test("a step inside an open modal dialog shows the speaker above it", async ({ page }) => {
  await open(page, "?modal");
  await run(page, { target: "#in-dialog", side: "right", dock: "end" });
  const { bubble, avatar } = await parts(page);
  const hits = await page.evaluate(
    ({ a, b }) => ({
      bubble: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest(".vt-bubble") !== null,
      avatar: document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2)?.className ?? "",
    }),
    { a: avatar, b: bubble },
  );
  expect(hits.bubble).toBe(true);
  expect(hits.avatar).toContain("vt-avatar");
});

test("dock auto picks the edge with more room beside the target and settles with the tail in place", async ({ page }) => {
  await open(page);
  await run(page, { target: "#near-right", side: "bottom", dock: "auto" });
  let p = await parts(page);
  await expect(page.locator(".vt-popover")).toHaveAttribute("data-vt-dock", "start");
  expect(p.avatar.x + p.avatar.width).toBeLessThanOrEqual(p.bubble.x + 1);
  await expectTailOnBubbleEdge(page, "#near-right");
  await run(page, { target: "#near-left", side: "bottom", dock: "auto" });
  p = await parts(page);
  await expect(page.locator(".vt-popover")).toHaveAttribute("data-vt-dock", "end");
  expect(p.avatar.x).toBeGreaterThanOrEqual(p.bubble.x + p.bubble.width - 1);
  await expectTailOnBubbleEdge(page, "#near-left");
});

test("a hidden step shows no avatar and the bubble keeps its place", async ({ page }) => {
  await open(page);
  await run(page, { hidden: true });
  await expect(page.locator(".vt-avatar")).toHaveCount(0);
  await expectTailOnBubbleEdge(page, "#center");
});

test("when nothing fits the popover is pinned and laid out as over, without a tail", async ({ page }) => {
  await page.setViewportSize({ width: 340, height: 200 });
  await open(page);
  await run(page, { side: "bottom" });
  await expect(page.locator(".vt-popover")).toHaveAttribute("data-vt-side", "over");
  await expect(page.locator(".vt-popover-arrow")).toBeHidden();
  const p = await parts(page);
  near(p.avatar.y + p.avatar.height, p.bubble.y + p.bubble.height);
  expect(overlaps(p.avatar, p.description)).toBe(false);
});

test("works under a custom namespace", async ({ page }) => {
  await open(page);
  await run(page, { side: "top", namespace: "acme" });
  await expect(page.locator(".vt-popover")).toHaveAttribute("data-vt-side", "top");
  await expect(page.locator(".vt-popover")).toHaveAttribute("data-acme-side", "top");
  await expectTailOnBubbleEdge(page, "#center");
});

test("with theme.css loaded the bubble, not the wrapper, carries the box", async ({ page }) => {
  await open(page, "?theme");
  await run(page);
  const styles = await page.evaluate(() => {
    const wrapper = getComputedStyle(document.querySelector(".vt-popover") as Element);
    const bubble = getComputedStyle(document.querySelector(".vt-bubble") as Element);
    return {
      wrapperShadow: wrapper.boxShadow,
      wrapperPadding: wrapper.paddingTop,
      wrapperBackground: wrapper.backgroundColor,
      bubbleShadow: bubble.boxShadow,
      bubblePadding: bubble.paddingTop,
    };
  });
  expect(styles.wrapperShadow).toBe("none");
  expect(styles.wrapperPadding).toBe("0px");
  expect(styles.wrapperBackground).toBe("rgba(0, 0, 0, 0)");
  expect(styles.bubbleShadow).not.toBe("none");
  expect(styles.bubblePadding).toBe("16px");
});

test("screenshots: right to left, dimmed, themed", async ({ page }, testInfo) => {
  await open(page, "?rtl&theme");
  await run(page, { side: "bottom", dim: true });
  await attach(page, testInfo, "rtl-dim-theme");
  await open(page, "?theme");
  await run(page, { target: "#near-right", side: "bottom", dock: "auto" });
  await attach(page, testInfo, "auto-dock-near-right");
});
