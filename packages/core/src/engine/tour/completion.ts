import type { Activation, Context } from "../core/context";
import { stepOption } from "../core/options";
import { isDummyElement } from "../core/utils";
import { announce } from "../popover/live-region";
import { isCurrent, latch, markDone, reopen } from "./lifecycle";
import { isActionStep } from "./step";

export function requestCompletion(ctx: Context, activation: Activation) {
  if (!latch(ctx, activation)) {
    return;
  }

  markDone(activation);
  const element = ctx.getState("__activeElement");
  ctx.getConfig("onStepCompleted")?.(isDummyElement(element) ? undefined : element, activation.step, ctx.getHookOpts());
  if (!isCurrent(ctx, activation)) {
    return;
  }

  const delay = stepOption(ctx, activation.step, "advanceDelay") ?? 0;
  if (delay <= 0) {
    ctx.tour.next();
    reopen(ctx, activation);
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

    ctx.tour.next();
    reopen(ctx, activation);
  }, delay);
  activation.controller.signal.addEventListener("abort", () => window.clearTimeout(timer));
}
