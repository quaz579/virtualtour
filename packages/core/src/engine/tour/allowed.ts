import type { AllowedElements, Context } from "../core/context";
import type { DriveStep } from "../types";
import { redrawOverlay } from "../overlay/overlay";
import { stepOption } from "../core/options";
import { fixedNames } from "../core/namespace";
import { isDummyElement, isInsideAllowedElement } from "../core/utils";

const ENGINE_UI = `[${fixedNames.attr.layer}], [${fixedNames.attr.overlay}], .${fixedNames.popover.root}`;

export function resolveAllowedSetting(ctx: Context, step: DriveStep): AllowedElements | undefined {
  return stepOption(ctx, step, "allowedElements");
}

export function resolveAllowedElements(setting: AllowedElements | undefined): Element[] {
  if (!setting) {
    return [];
  }

  if (typeof setting === "function") {
    return Array.from(setting() || []);
  }

  const entries = Array.isArray(setting) ? setting : [setting];

  return entries.flatMap(entry => {
    if (typeof entry === "string") {
      return Array.from(document.querySelectorAll(entry));
    }

    return entry ? [entry] : [];
  });
}

export function trackAllowedElements(ctx: Context, step: DriveStep, signal: AbortSignal) {
  const setting = resolveAllowedSetting(ctx, step);
  if (!setting) {
    return;
  }

  const { names } = ctx;
  const isMarked = (element: Element) =>
    element.classList.contains(names.extra) && element.hasAttribute(names.attr.extra);
  const mark = (element: Element) => {
    element.classList.add(names.extra);
    element.setAttribute(names.attr.extra, "");
  };
  const unmark = (element: Element) => {
    element.classList.remove(names.extra);
    element.removeAttribute(names.attr.extra);
  };

  let marked = new Set<Element>();
  let frame: number | undefined;

  const sync = () => {
    if (signal.aborted) {
      return;
    }

    const matches = new Set(resolveAllowedElements(setting));
    marked.forEach(element => {
      if (!matches.has(element)) {
        unmark(element);
      }
    });
    matches.forEach(element => {
      if (!isMarked(element)) {
        mark(element);
      }
    });
    marked = matches;

    const active = ctx.getState("activeElement");
    const isRaised = !!active && !isDummyElement(active) && isInsideAllowedElement(active);
    if (active && isRaised !== active.hasAttribute(names.attr.raised)) {
      active.classList.toggle(names.targetRaised, isRaised);
      active.toggleAttribute(names.attr.raised, isRaised);
      redrawOverlay(ctx);
    }
  };

  const schedule = () => {
    if (frame !== undefined) {
      return;
    }

    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      sync();
      redrawOverlay(ctx);
    });
  };

  const observer = new MutationObserver(records => {
    let isRelevant = false;
    records.forEach(record => {
      const target = record.target as Element;
      if (target.closest?.(ENGINE_UI)) {
        return;
      }

      isRelevant = true;
      const isMarkerChange = record.attributeName === "class" || record.attributeName === names.attr.extra;
      if (isMarkerChange && marked.has(target) && !isMarked(target)) {
        mark(target);
      }
    });

    if (isRelevant) {
      schedule();
    }
  });

  const isLookup = typeof setting === "function" || [setting].flat().some(entry => typeof entry === "string");

  sync();
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    ...(isLookup ? {} : { attributeFilter: ["class", names.attr.extra] }),
  });
  ctx.setState("__syncAllowedElements", sync);

  signal.addEventListener("abort", () => {
    observer.disconnect();
    if (frame !== undefined) {
      window.cancelAnimationFrame(frame);
    }

    marked.forEach(unmark);
    if (ctx.getState("__syncAllowedElements") === sync) {
      ctx.setState("__syncAllowedElements", undefined);
    }
  });
}

export function isFocusWithinStep(ctx: Context, element: Element, step: DriveStep): boolean {
  const focused = document.activeElement;
  if (!focused || focused === document.body) {
    return false;
  }

  const isInteractive = stepOption(ctx, step, "disableActiveInteraction") !== true;
  if (!isDummyElement(element) && isInteractive && element.contains(focused)) {
    return true;
  }

  return resolveAllowedElements(resolveAllowedSetting(ctx, step)).some(allowed => allowed.contains(focused));
}
