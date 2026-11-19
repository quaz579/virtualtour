import type { Activation, Context } from "../core/context";
import { stepOption } from "../core/options";
import { isDummyElement } from "../core/utils";
import { announce } from "../popover/live-region";
import { isCurrent, latch, markDone, reopen } from "./lifecycle";
import { isActionStep } from "./step";

function moveOn(ctx: Context, activation: Activation) {
  const settled = () => {
    if (reopen(ctx, activation)) {
      ctx.tour.refreshPopover();
    }
  };
  const moving = ctx.tour.next();
  if (moving && typeof moving.then === "function") {
    moving.then(settled, settled);
    return;
  }

  settled();
}

export function requestCompletion(ctx: Context, activation: Activation) {
  if (!latch(ctx, activation)) {
    return;
  }

  markDone(activation);
  const element = ctx.getState("__activeElement");
  try {
    ctx.getConfig("onStepCompleted")?.(isDummyElement(element) ? undefined : element, activation.step, ctx.getHookOpts());
  } catch (error) {
    console.error("[virtualtour] onStepCompleted threw:", error);
  }
  if (!isCurrent(ctx, activation)) {
    return;
  }

  const delay = stepOption(ctx, activation.step, "advanceDelay") ?? 0;
  if (delay <= 0) {
    moveOn(ctx, activation);
    return;
  }

  ctx.tour.refreshPopover();
  if (isActionStep(activation.step)) {
    announce(ctx, activation.step.popover?.doneBtnText || ctx.getConfig("doneBtnText") || "Done");
  }

  const timer = window.setTimeout(() => {
    if (!isCurrent(ctx, activation)) {
      return;
    }

    moveOn(ctx, activation);
  }, delay);
  activation.controller.signal.addEventListener("abort", () => window.clearTimeout(timer));
}
