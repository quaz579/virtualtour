import type { DriveStep } from "../types";
import type { Context } from "./context";
import { prefersReducedMotion } from "./env";
import { EXTRA_SELECTOR, fixedNames } from "./namespace";

export function resolveElement(element: DriveStep["element"]): Element | null | undefined {
  if (typeof element === "function") {
    return element();
  }

  if (typeof element === "string") {
    return document.querySelector(element);
  }

  return element;
}

export const DUMMY_ELEMENT_ID = fixedNames.dummyId;

export function isDummyElement(element: Element | undefined): boolean {
  return !element || element.id === DUMMY_ELEMENT_ID;
}

export function isInsideAllowedElement(element: Element): boolean {
  return !!element.closest(EXTRA_SELECTOR);
}

export function isScrollable(element: Element) {
  const style = window.getComputedStyle(element);
  return [style.overflow, style.overflowX, style.overflowY].some(value => {
    return value === "auto" || value === "scroll";
  });
}

export function easeInOutQuad(elapsed: number, initialValue: number, amountOfChange: number, duration: number): number {
  if ((elapsed /= duration / 2) < 1) {
    return (amountOfChange / 2) * elapsed * elapsed + initialValue;
  }
  return (-amountOfChange / 2) * (--elapsed * (elapsed - 2) - 1) + initialValue;
}

const FOCUSABLE_QUERY = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(", ");

function focusableCandidates(parentEls: Element[]): HTMLElement[] {
  return parentEls.flatMap(parentEl => {
    const isParentFocusable = parentEl.matches(FOCUSABLE_QUERY);
    const focusableEls: HTMLElement[] = Array.from(parentEl.querySelectorAll(FOCUSABLE_QUERY));

    return [...(isParentFocusable ? [parentEl as HTMLElement] : []), ...focusableEls];
  });
}

function isFocusable(el: HTMLElement) {
  const style = getComputedStyle(el);
  return style.pointerEvents !== "none" && style.visibility === "visible" && isElementVisible(el);
}

const MAX_TIMER_MS = 2147483647;

export function timerDelay(ms: number): number {
  return Math.min(ms, MAX_TIMER_MS);
}

export function getFocusableElements(parentEls: Element[]) {
  return focusableCandidates(parentEls).filter(isFocusable);
}

export function bringInView(element: Element, scrollIntoView?: false | ScrollIntoViewOptions, shouldSmoothScroll?: boolean) {
  if (scrollIntoView === false || !element || isElementInView(element)) {
    return;
  }

  const options: ScrollIntoViewOptions = scrollIntoView ?? defaultScrollOptions(element, shouldSmoothScroll);

  element.scrollIntoView(prefersReducedMotion() && options.behavior !== "auto" && options.behavior !== "instant" ? { ...options, behavior: "instant" } : options);
}

function defaultScrollOptions(element: Element, shouldSmoothScroll?: boolean): ScrollIntoViewOptions {
  const isTallerThanViewport = (element as HTMLElement).offsetHeight > window.innerHeight;

  return {
    behavior: !shouldSmoothScroll || hasScrollableParent(element) ? "auto" : "smooth",
    inline: "center",
    block: isTallerThanViewport ? "start" : "center",
  };
}

function hasScrollableParent(e: Element) {
  if (!e || !e.parentElement) {
    return;
  }

  const parent = e.parentElement;

  return parent.scrollHeight > parent.clientHeight;
}

function isElementInView(element: Element) {
  const rect = element.getBoundingClientRect();

  const isInViewport =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth);

  return isInViewport && !isClippedByScrollContainer(element, rect);
}

function isClippedByScrollContainer(element: Element, rect: DOMRect) {
  const clipped = clipRectByScrollParents(element, rect, true);

  return (
    clipped.left !== rect.left ||
    clipped.top !== rect.top ||
    clipped.right !== rect.right ||
    clipped.bottom !== rect.bottom
  );
}

function createsContainingBlock(style: CSSStyleDeclaration) {
  const set = (value: string | undefined) => !!value && value !== "none";

  return (
    style.position !== "static" ||
    set(style.transform) ||
    set(style.perspective) ||
    set(style.filter) ||
    set(style.backdropFilter) ||
    set(style.translate) ||
    set(style.rotate) ||
    set(style.scale) ||
    /size|inline-size/.test(style.containerType ?? "") ||
    style.contentVisibility === "auto" ||
    /layout|paint|strict|content/.test(style.contain ?? "") ||
    /transform|perspective|filter/.test(style.willChange ?? "")
  );
}

export function clipRectByScrollParents(element: Element, rect: DOMRect, scrollableOnly = false): DOMRect {
  let left = rect.left;
  let top = rect.top;
  let right = rect.right;
  let bottom = rect.bottom;
  let current: Element | null = element;
  let currentPosition = getComputedStyle(element).position;
  let skipping = false;

  while (current) {
    if (currentPosition === "fixed") {
      break;
    }

    if (currentPosition === "absolute") {
      skipping = true;
    }

    const parent: HTMLElement | null = current.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) {
      break;
    }

    const style = getComputedStyle(parent);
    const isContainingBlock = createsContainingBlock(style);
    const clipsOn = (value: string) => (scrollableOnly ? value === "auto" || value === "scroll" : !!value && value !== "visible");
    const clipsX = clipsOn(style.overflowX);
    const clipsY = clipsOn(style.overflowY);
    if ((!skipping || isContainingBlock) && (clipsX || clipsY)) {
      const box = parent.getBoundingClientRect();
      const boxLeft = box.left + parent.clientLeft;
      const boxTop = box.top + parent.clientTop;
      const boxRight = boxLeft + (parent.clientWidth || box.width);
      const boxBottom = boxTop + (parent.clientHeight || box.height);

      if (clipsX) {
        left = Math.min(Math.max(left, boxLeft), boxRight);
        right = Math.max(Math.min(right, boxRight), left);
      }

      if (clipsY) {
        top = Math.min(Math.max(top, boxTop), boxBottom);
        bottom = Math.max(Math.min(bottom, boxBottom), top);
      }
    }

    if (isContainingBlock) {
      skipping = false;
    }

    current = parent;
    currentPosition = style.position;
  }

  return new DOMRect(left, top, right - left, bottom - top);
}

export function isElementVisible(el: HTMLElement) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

const dialogsWithLayer = new WeakSet<Element>();

export type LayerKind = "popover" | "overlay";

const resolvedMounts = new WeakMap<Context, Partial<Record<LayerKind, Element>>>();

export function resolveMount(ctx: Context, kind: LayerKind, isFresh = false): Element | null {
  const cache = resolvedMounts.get(ctx) ?? {};
  resolvedMounts.set(ctx, cache);

  const cached = cache[kind];
  if (!isFresh && cached?.isConnected) {
    return cached;
  }

  delete cache[kind];
  const option = ctx.getConfig(kind === "popover" ? "mountIn" : "dimMountIn");
  if (option === undefined || option === null) {
    return null;
  }

  const mount = typeof option === "function" ? option() : option;
  if (
    !(mount instanceof Element) ||
    mount.ownerDocument !== document ||
    mount.getRootNode() !== document
  ) {
    throw new Error("mountIn must be an element in the document");
  }

  cache[kind] = mount;

  return mount;
}

export function layerFor(ctx: Context, element: Element, kind: LayerKind): Element {
  const dialog = element.closest("dialog[open]");
  if (!dialog) {
    return resolveMount(ctx, kind) ?? document.body;
  }

  if (!("showPopover" in dialog)) {
    return dialog;
  }

  let layer = dialog.querySelector<HTMLElement>(`:scope > [${fixedNames.attr.layer}]`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = fixedNames.layer;
    layer.setAttribute(fixedNames.attr.layer, "");
    layer.setAttribute("popover", "manual");
    dialog.appendChild(layer);
  }

  if (!dialogsWithLayer.has(dialog)) {
    dialogsWithLayer.add(dialog);
    dialog.addEventListener("close", () => {
      dialog.querySelector<HTMLElement>(`:scope > [${fixedNames.attr.layer}]:popover-open`)?.hidePopover();
    });
  }

  if (!layer.matches(":popover-open")) {
    layer.showPopover();
  }

  return layer;
}

function dropEmptyLayer(layer: Element | null) {
  if (layer?.hasAttribute(fixedNames.attr.layer) && !layer.childElementCount) {
    layer.remove();
  }
}

export function removeFromLayer(node: Element) {
  const layer = node.parentElement;
  node.remove();
  dropEmptyLayer(layer);
}

export function placeInLayer(node: Element, layer: Element, isUnderneath = false) {
  if (isUnderneath && layer !== document.body) {
    layer.prepend(node);
    return;
  }

  layer.appendChild(node);
}

export function moveToLayerOf(ctx: Context, node: Element, element: Element, kind: LayerKind): boolean {
  const isUnderneath = kind === "overlay";
  const layer = layerFor(ctx, element, kind);
  const previous = node.parentElement;
  if (previous === layer) {
    return false;
  }

  placeInLayer(node, layer, isUnderneath);
  dropEmptyLayer(previous);

  return true;
}

const KEY_WIDGETS = [
  "input",
  "textarea",
  "select",
  "[role=combobox]",
  "[role=grid]",
  "[role=listbox]",
  "[role=menu]",
  "[role=menubar]",
  "[role=radiogroup]",
  "[role=slider]",
  "[role=spinbutton]",
  "[role=tablist]",
  "[role=textbox]",
  "[role=tree]",
  "[role=treegrid]",
].join(", ");

export function isKeyWidget(node: EventTarget | null | undefined): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  return node.isContentEditable || !!node.closest(KEY_WIDGETS);
}
