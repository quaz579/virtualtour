import type { Context } from "../core/context";
import { fixedNames } from "../core/namespace";

const POPOVER_CLASS = fixedNames.popover.nudge;
const timers = new WeakMap<Element, number>();

function nudgeDuration(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(fixedNames.nudgeDurationVar).trim();
  const value = parseFloat(raw);
  if (Number.isNaN(value)) {
    return 500;
  }

  return raw.endsWith("ms") || !raw.endsWith("s") ? value : value * 1000;
}

function untilAnimationEnds(element: Element, onEnd: () => void) {
  window.clearTimeout(timers.get(element));

  const finish = () => {
    globalThis.clearTimeout(timers.get(element));
    timers.delete(element);
    element.removeEventListener("animationend", onAnimationEnd);
    onEnd();
  };

  const onAnimationEnd = (event: Event) => {
    const name = (event as AnimationEvent).animationName;
    if (name && !name.startsWith(fixedNames.nudgeAnimationPrefix)) {
      return;
    }

    finish();
  };

  element.addEventListener("animationend", onAnimationEnd);
  timers.set(element, window.setTimeout(finish, nudgeDuration() + 150));
}

function restartAnimation(wrapper: HTMLElement) {
  wrapper.classList.remove(POPOVER_CLASS);
  void wrapper.offsetWidth;
  wrapper.classList.add(POPOVER_CLASS);
}

export function nudge(ctx: Context) {
  const wrapper = ctx.getState("popover")?.wrapper;
  if (!ctx.getState("isInitialized") || !wrapper || !wrapper.isConnected || wrapper.style.display === "none") {
    return;
  }

  restartAnimation(wrapper);
  untilAnimationEnds(wrapper, () => wrapper.classList.remove(POPOVER_CLASS));

  const step = ctx.getState("__activation")?.step;
  if (step) {
    ctx.getConfig("onNudge")?.(step);
  }
}
