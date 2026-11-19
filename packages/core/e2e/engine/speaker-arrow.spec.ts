import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, box, near, openFixture, popover, settle, title } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

type Side = "top" | "bottom" | "left" | "right";

const SPEAKER_CSS = `
  .vt-speaker { display: inline-flex; align-items: flex-end; gap: 8px; background: transparent; box-shadow: none; padding: 0; max-width: none; }
  .vt-speaker[data-vt-side="left"], .vt-speaker[data-vt-side="right"] { flex-direction: column; align-items: flex-end; }
  .vt-speaker .vt-bubble { background: #fff; padding: 14px; border-radius: 6px; min-width: 200px; max-width: 260px; box-shadow: 0 1px 10px rgba(0,0,0,.4); }
  .vt-speaker .vt-avatar-slot { width: 64px; height: 120px; }
  .vt-speaker .vt-avatar { width: 64px; height: 120px; background: #c33; }
`;

async function show(page: Page, side: Side, target: string, align: "start" | "center" | "end" = "start") {
  await page.addStyleTag({ content: SPEAKER_CSS });
  await page.evaluate(
    ({ side, target, align }) => {
      window.tour?.destroy();
      window.tour = window.__engine.createEngine({
        animate: false,
        stagePadding: 0,
        popoverOffset: 0,
        presenter: {
          layout: "speaker",
          mount(popover) {
            const avatar = document.createElement("div");
            avatar.className = "vt-avatar";
            popover.avatarSlot!.append(avatar);
          },
        },
      });
      window.tour.highlight({
        element: target,
        popover: { title: "Speaker", description: "A longer line of text so the bubble has some height.", side, align, flip: false, shift: true },
      });
    },
    { side, target, align }
  );
  await expect(title(page)).toHaveText("Speaker");
  await settle(page);
}

const arrowBox = (page: Page) => box(page.locator(".vt-popover-arrow"));
const bubbleBox = (page: Page) => box(page.locator(".vt-bubble"));

for (const side of ["bottom", "top"] as const) {
  test(`${side}: the tail sits on the bubble's edge, inside its horizontal span`, async ({ page }) => {
    await openFixture(page);
    await show(page, side, side === "bottom" ? "#one" : "#outside");
    const arrow = await arrowBox(page);
    const bubble = await bubbleBox(page);
    const wrapper = await box(popover(page));

    expect(bubble.y).toBeGreaterThanOrEqual(wrapper.y - 1);
    if (side === "bottom") {
      near(arrow.y + arrow.height, bubble.y);
    } else {
      near(arrow.y, bubble.y + bubble.height);
    }
    expect(arrow.x + arrow.width / 2).toBeGreaterThanOrEqual(bubble.x);
    expect(arrow.x + arrow.width / 2).toBeLessThanOrEqual(bubble.x + bubble.width);
  });
}

for (const side of ["right", "left"] as const) {
  test(`${side}: the tail sits on the bubble's edge, inside its vertical span`, async ({ page }) => {
    await openFixture(page);
    await show(page, side, side === "right" ? "#one" : "#side-btn");
    const arrow = await arrowBox(page);
    const bubble = await bubbleBox(page);

    if (side === "right") {
      near(arrow.x + arrow.width, bubble.x);
    } else {
      near(arrow.x, bubble.x + bubble.width);
    }
    expect(arrow.y + arrow.height / 2).toBeGreaterThanOrEqual(bubble.y);
    expect(arrow.y + arrow.height / 2).toBeLessThanOrEqual(bubble.y + bubble.height);
  });
}

test("the tail never lands under the avatar slot", async ({ page }) => {
  await openFixture(page);
  await show(page, "bottom", "#one", "end");
  const arrow = await arrowBox(page);
  const bubble = await bubbleBox(page);

  expect(arrow.x + arrow.width / 2).toBeGreaterThanOrEqual(bubble.x);
  expect(arrow.x + arrow.width / 2).toBeLessThanOrEqual(bubble.x + bubble.width);
});

test("keeps the dialog role, label and structure with the avatar slot beside the bubble", async ({ page }) => {
  await openFixture(page);
  await show(page, "bottom", "#one");

  await expect(popover(page)).toHaveAttribute("role", "dialog");
  await expect(popover(page)).toHaveAttribute("aria-labelledby", "vt-popover-title");
  await expect(page.locator(".vt-popover > .vt-bubble > .vt-popover-title")).toHaveCount(1);
  await expect(page.locator(".vt-popover > .vt-avatar-slot > .vt-avatar")).toHaveCount(1);
  const bubble = await bubbleBox(page);
  const slot = await box(page.locator(".vt-avatar-slot"));
  expect(slot.x).toBeGreaterThanOrEqual(bubble.x + bubble.width);
});

test("reposition on resize keeps the tail on the bubble", async ({ page }) => {
  await openFixture(page);
  await show(page, "bottom", "#one");
  await page.setViewportSize({ width: 900, height: 700 });
  await settle(page);
  await page.evaluate(() => window.tour.refresh());
  await settle(page);
  const arrow = await arrowBox(page);
  const bubble = await bubbleBox(page);

  near(arrow.y + arrow.height, bubble.y);
  expect(arrow.x + arrow.width / 2).toBeGreaterThanOrEqual(bubble.x);
  expect(arrow.x + arrow.width / 2).toBeLessThanOrEqual(bubble.x + bubble.width);
});
