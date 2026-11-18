import { Context } from "../core/context";
import { fixedNames, type Names } from "../core/namespace";
import type { DriveStep } from "../types";
import { refreshOverlay, trackActiveElement, transitionStage } from "../overlay/overlay";
import { beginTransition, endTransition, isCurrent, isTransitioning, missRefresh, ownsTransition } from "./lifecycle";
import { stepOption } from "../core/options";
import { hidePopover } from "../popover/popover";
import { renderStepPopover, repositionStepPopover } from "./step";
import {
  bringInView,
  DUMMY_ELEMENT_ID,
  isDummyElement,
  isInsideAllowedElement,
  isScrollable,
  moveToLayerOf,
  resolveElement,
} from "../core/utils";

const POPOVER_ARIA: Record<string, string> = {
  "aria-haspopup": "dialog",
  "aria-expanded": "true",
  "aria-controls": fixedNames.popover.contentId,
};

const ariaOwned = new WeakSet<Element>();

function setPopoverAria(element: Element) {
  const isAppOwned = Object.keys(POPOVER_ARIA).some(name => element.hasAttribute(name));
  if (isAppOwned && !ariaOwned.has(element)) {
    return;
  }

  for (const [name, value] of Object.entries(POPOVER_ARIA)) {
    element.setAttribute(name, value);
  }
  ariaOwned.add(element);
}

function restoreAria(element: Element) {
  if (!ariaOwned.has(element)) {
    return;
  }

  for (const [name, value] of Object.entries(POPOVER_ARIA)) {
    if (element.getAttribute(name) === value) {
      element.removeAttribute(name);
    }
  }

  ariaOwned.delete(element);
}

export function mountDummyElement(): Element {
  const existingDummy = document.getElementById(DUMMY_ELEMENT_ID);
  if (existingDummy) {
    return existingDummy;
  }

  const element = document.createElement("div");

  element.id = DUMMY_ELEMENT_ID;
  element.style.cssText = "width:0;height:0;pointer-events:none;opacity:0;position:fixed;top:50%;left:50%";

  document.body.appendChild(element);

  return element;
}

export function highlight(ctx: Context, step: DriveStep) {
  let elemObj = resolveElement(step.element);

  if (!elemObj) {
    elemObj = mountDummyElement();
  }

  transferHighlight(ctx, elemObj, step);
}

function observeSize(ctx: Context, element?: Element) {
  const observer = ctx.getState("__resizeObserver");
  observer?.disconnect();
  if (element) {
    observer?.observe(element);
  }
}

export function refreshActiveHighlight(ctx: Context) {
  const activeHighlight = ctx.getState("__activeElement");
  const activeStep = ctx.getState("__activeStep");

  if (!activeHighlight || !activeStep) {
    return;
  }

  if (isTransitioning(ctx)) {
    missRefresh(ctx);
    refreshOverlay(ctx);
    return;
  }

  ctx.getState("__syncAllowedElements")?.();
  followLayer(ctx, activeHighlight);
  trackActiveElement(ctx, activeHighlight);
  refreshOverlay(ctx);
  repositionStepPopover(ctx, activeHighlight, activeStep);
}

function followLayer(ctx: Context, element: Element) {
  const wrapper = ctx.getState("popover")?.wrapper;
  if (wrapper) {
    moveToLayerOf(wrapper, element);
  }
}

function transferHighlight(ctx: Context, toElement: Element, toStep: DriveStep) {
  const activation = ctx.getState("__activation");
  const isSuperseded = () => !isCurrent(ctx, activation);

  observeSize(ctx);
  const duration = ctx.getConfig("duration") || 400;
  const start = Date.now();

  const fromStep = ctx.getState("__activeStep");
  const fromElement = ctx.getState("__activeElement") || toElement;

  const isFirstHighlight = !fromElement || fromElement === toElement;
  const isToDummyElement = isDummyElement(toElement);
  const isFromDummyElement = isDummyElement(fromElement);

  const hasOverlay = () => ctx.getConfig("overlay") !== false;
  const isAnimatedTour = !!ctx.getConfig("animate") && hasOverlay();
  const highlightStartedHook = toStep.onHighlightStarted || ctx.getConfig("onHighlightStarted");
  const highlightedHook = toStep.onHighlighted || ctx.getConfig("onHighlighted");
  const deselectedHook = fromStep?.onDeselected || ctx.getConfig("onDeselected");
  const signal = activation?.controller.signal;

  const hookOpts = ctx.getHookOpts();

  if (fromStep && fromStep !== toStep && deselectedHook) {
    deselectedHook(isFromDummyElement ? undefined : fromElement, fromStep, hookOpts);
    if (isSuperseded()) {
      return;
    }
  }

  if (highlightStartedHook) {
    highlightStartedHook(isToDummyElement ? undefined : toElement, toStep, { ...hookOpts, signal });
    if (isSuperseded()) {
      return;
    }
  }

  const hasDelayedPopover = !isFirstHighlight && isAnimatedTour;
  let isPopoverRendered = false;

  hidePopover(ctx.getState("popover"));

  ctx.setState("previousStep", fromStep);
  ctx.setState("previousElement", fromElement);
  ctx.setState("activeStep", toStep);
  ctx.setState("activeElement", toElement);

  const commitBeforeHighlightedHook = (targetElement: Element) => {
    ctx.setState("__previousStep", fromStep);
    ctx.setState("__previousElement", fromElement);
    ctx.setState("__activeStep", toStep);
    ctx.setState("__activeElement", targetElement);
  };

  const animate = () => {
    if (!ownsTransition(ctx, animate)) {
      return;
    }

    const elapsed = Date.now() - start;
    const timeRemaining = duration - elapsed;
    const isHalfwayThrough = timeRemaining <= duration / 2;
    const reboundElement = ctx.getState("activeStep") === toStep ? ctx.getState("activeElement") : undefined;
    const targetElement = reboundElement || toElement;

    if (toStep.popover && isHalfwayThrough && !isPopoverRendered && hasDelayedPopover) {
      renderStepPopover(ctx, targetElement, toStep);
      isPopoverRendered = true;
    }

    if (ctx.getConfig("animate") && hasOverlay() && elapsed < duration) {
      transitionStage(ctx, elapsed, duration, fromElement, targetElement);
    } else {
      trackActiveElement(ctx, targetElement);

      commitBeforeHighlightedHook(targetElement);

      if (highlightedHook) {
        highlightedHook(isToDummyElement ? undefined : targetElement, toStep, { ...ctx.getHookOpts(), signal });
      }

      if (!ownsTransition(ctx, animate)) {
        return;
      }

      const hasMissedRefresh = endTransition(ctx);
      observeSize(ctx, targetElement);
      if (hasMissedRefresh) {
        refreshActiveHighlight(ctx);
      }

      return;
    }

    window.requestAnimationFrame(animate);
  };

  beginTransition(ctx, animate);

  window.requestAnimationFrame(animate);

  clearParentMarks(ctx);

  bringInView(toElement, ctx.getConfig("smoothScroll"));
  if (!hasDelayedPopover && toStep.popover) {
    renderStepPopover(ctx, toElement, toStep);
  }

  clearElementMarks(ctx);
  markActiveElement(ctx, toElement, toStep);
}

const classGuards = new WeakMap<Element, MutationObserver>();

type Marker = { className: string; attribute: string };

function targetMarkers(names: Names): { target: Marker; blocked: Marker; raised: Marker } {
  return {
    target: { className: names.target, attribute: names.attr.target },
    blocked: { className: names.targetBlocked, attribute: names.attr.blocked },
    raised: { className: names.targetRaised, attribute: names.attr.raised },
  };
}

function setMarker(element: Element, marker: Marker, isOn: boolean) {
  element.classList.toggle(marker.className, isOn);
  element.toggleAttribute(marker.attribute, isOn);
}

function guardMarkers(element: Element, allAttributes: string[], markersToKeep: () => Marker[]) {
  classGuards.get(element)?.disconnect();

  const observer = new MutationObserver(() => {
    markersToKeep().forEach(marker => {
      if (!element.classList.contains(marker.className) || !element.hasAttribute(marker.attribute)) {
        setMarker(element, marker, true);
      }
    });
  });
  observer.observe(element, {
    attributes: true,
    attributeFilter: ["class", ...allAttributes],
  });
  classGuards.set(element, observer);
}

function clearActiveElement(ctx: Context, element: Element) {
  classGuards.get(element)?.disconnect();
  classGuards.delete(element);
  const markers = targetMarkers(ctx.names);
  setMarker(element, markers.target, false);
  setMarker(element, markers.blocked, false);
  setMarker(element, markers.raised, false);
  restoreAria(element);
}

function clearElementMarks(ctx: Context) {
  const marked = ctx.getState("__marked")?.element;
  new Set([marked, ...document.querySelectorAll(`[${ctx.names.attr.target}]`)]).forEach(element => {
    if (element) {
      clearActiveElement(ctx, element);
    }
  });
}

function clearParentMarks(ctx: Context) {
  const marked = ctx.getState("__marked")?.parent;
  new Set([marked, ...document.querySelectorAll(`[${ctx.names.attr.targetParent}]`)]).forEach(parent => {
    parent?.classList.remove(ctx.names.targetParent);
    parent?.removeAttribute(ctx.names.attr.targetParent);
    parent?.removeAttribute(ctx.names.attr.lockScroll);
  });
}

function markActiveElement(ctx: Context, element: Element, step: DriveStep) {
  const markers = targetMarkers(ctx.names);
  const isBlocked = stepOption(ctx, step, "disableActiveInteraction") === true;
  if (isBlocked) {
    setMarker(element, markers.blocked, true);
  }

  const parent = element.parentElement;
  const markedParent = parent && parent !== document.body ? parent : undefined;
  if (markedParent) {
    markedParent.classList.add(ctx.names.targetParent);
    markedParent.setAttribute(ctx.names.attr.targetParent, "");

    if (ctx.getConfig("lockScrollParent") && isScrollable(markedParent)) {
      markedParent.setAttribute(ctx.names.attr.lockScroll, "");
    }
  }

  ctx.setState("__marked", { element, parent: markedParent });
  setMarker(element, markers.target, true);
  if (!isDummyElement(element)) {
    setPopoverAria(element);
    setMarker(element, markers.raised, isInsideAllowedElement(element));
    guardMarkers(element, Object.values(markers).map(marker => marker.attribute), () => [
      markers.target,
      ...(isBlocked ? [markers.blocked] : []),
      ...(isInsideAllowedElement(element) ? [markers.raised] : []),
    ]);
  }
}

export function removeDummyElement() {
  document.getElementById(DUMMY_ELEMENT_ID)?.remove();
}

export function destroyHighlight(ctx: Context) {
  removeDummyElement();
  clearParentMarks(ctx);
  clearElementMarks(ctx);
}

export function rebindActiveElement(ctx: Context, element: Element) {
  const step = ctx.getState("activeStep");
  if (!step) {
    return;
  }

  clearParentMarks(ctx);
  clearElementMarks(ctx);
  markActiveElement(ctx, element, step);

  ctx.setState("activeElement", element);
  ctx.setState("__activeElement", element);
  observeSize(ctx, element);

  followLayer(ctx, element);
  trackActiveElement(ctx, element);
  repositionStepPopover(ctx, element, step);
}
