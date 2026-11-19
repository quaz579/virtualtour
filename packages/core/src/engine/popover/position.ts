import type { Alignment, Placement, PopoverDOM, Side } from "./popover";
import type { RepositionInfo } from "../types";
import { fixedNames } from "../core/namespace";
import { clipRectByScrollParents } from "../core/utils";

const popoverNames = fixedNames.popover;

export type PositionOptions = {
  side: Placement;
  align: Alignment;
  offset: number;
  padding: number;
  boundaryPadding?: number;
  boundary?: "viewport" | "scrollParents";
  centered?: boolean;
  hasTarget?: boolean;
  sideAttribute?: string;
  strategy?: "fixed" | "absolute";
};

type PopoverDimensions = {
  width: number;
  height: number;
  realWidth: number;
  realHeight: number;
};

function getPopoverDimensions(popover: PopoverDOM, offset: number): PopoverDimensions {
  const boundingClientRect = popover.wrapper.getBoundingClientRect();

  return {
    width: boundingClientRect.width + offset,
    height: boundingClientRect.height + offset,

    realWidth: boundingClientRect.width,
    realHeight: boundingClientRect.height,
  };
}

type Bounds = { left: number; top: number; right: number; bottom: number };

function resolveBounds(
  anchor: Element,
  options: PositionOptions,
  needWidth: number,
  needHeight: number
): Bounds {
  const inset = options.boundaryPadding || 0;
  const viewport = {
    left: inset,
    top: inset,
    right: window.innerWidth - inset,
    bottom: window.innerHeight - inset,
  };

  if (options.centered || options.boundary === "viewport") {
    return viewport;
  }

  const clipped = clipRectByScrollParents(anchor, new DOMRect(0, 0, window.innerWidth, window.innerHeight), true);
  const bounds = { ...viewport };

  if (clipped.width >= needWidth) {
    bounds.left = Math.max(viewport.left, clipped.left);
    bounds.right = Math.min(viewport.right, clipped.right);
  }

  if (clipped.height >= needHeight) {
    bounds.top = Math.max(viewport.top, clipped.top);
    bounds.bottom = Math.min(viewport.bottom, clipped.bottom);
  }

  return bounds;
}

function alignAlongEdge(
  alignment: Alignment,
  elementStart: number,
  elementSize: number,
  popoverSize: number,
  boundsStart: number,
  boundsEnd: number,
  padding: number,
  arrowSize: number
): number {
  let start: number;
  if (alignment === "start") {
    start = elementStart - padding;
  } else if (alignment === "end") {
    start = elementStart - popoverSize + elementSize + padding;
  } else if (alignment === "center") {
    start = elementStart + elementSize / 2 - popoverSize / 2;
  } else {
    return 0;
  }

  return Math.max(Math.min(start, boundsEnd - popoverSize - arrowSize), boundsStart + arrowSize);
}

function toAbsolute(wrapper: HTMLElement, width: number, height: number) {
  const { style } = wrapper;
  const left = style.left === "auto" ? window.innerWidth - parseFloat(style.right) - width : parseFloat(style.left);
  const top = style.top === "auto" ? window.innerHeight - parseFloat(style.bottom) - height : parseFloat(style.top);

  wrapper.setAttribute(fixedNames.attr.strategy, "absolute");
  style.right = "auto";
  style.bottom = "auto";
  style.left = "0px";
  style.top = "0px";

  const origin = wrapper.getBoundingClientRect();
  style.left = `${left - origin.left}px`;
  style.top = `${top - origin.top}px`;
}

export function repositionPopover(popover: PopoverDOM, anchor: Element, options: PositionOptions): RepositionInfo {
  const { align: requiredAlignment, side } = options;
  const requiredSide: Placement = options.centered ? "over" : side;
  const popoverPadding = options.padding;
  const { style, classList } = popover.wrapper;
  if (popover.wrapper.hasAttribute(fixedNames.attr.strategy)) {
    popover.wrapper.removeAttribute(fixedNames.attr.strategy);
    style.left = style.top = style.right = style.bottom = "";
  }

  const popoverDimensions = getPopoverDimensions(popover, options.offset);
  const popoverArrowDimensions = popover.arrow.getBoundingClientRect();
  const elementDimensions = anchor.getBoundingClientRect();

  const topValue = elementDimensions.top - popoverDimensions.height;
  const bottomValue = window.innerHeight - (elementDimensions.bottom + popoverDimensions.height);
  const leftValue = elementDimensions.left - popoverDimensions.width;
  const rightValue = window.innerWidth - (elementDimensions.right + popoverDimensions.width);

  const fits = (b: Bounds) => ({
    top: topValue >= b.top,
    bottom: bottomValue >= window.innerHeight - b.bottom,
    left: leftValue >= b.left,
    right: rightValue >= window.innerWidth - b.right,
  });
  const anyFits = (f: ReturnType<typeof fits>) => f.top || f.bottom || f.left || f.right;

  const edgeRoom = popoverArrowDimensions.width * 2;
  let bounds = resolveBounds(
    anchor,
    options,
    popoverDimensions.realWidth + edgeRoom,
    popoverDimensions.realHeight + edgeRoom
  );
  let fit = fits(bounds);
  if (!anyFits(fit) && options.boundary !== "viewport") {
    bounds = resolveBounds(anchor, { ...options, boundary: "viewport" }, 0, 0);
    fit = fits(bounds);
  }

  let isTopOptimal = fit.top;
  let isBottomOptimal = fit.bottom;
  let isLeftOptimal = fit.left;
  let isRightOptimal = fit.right;

  const arrowSize = popoverArrowDimensions.width;
  const alignTop = () =>
    alignAlongEdge(
      requiredAlignment,
      elementDimensions.top,
      elementDimensions.height,
      popoverDimensions.realHeight,
      bounds.top,
      bounds.bottom,
      popoverPadding,
      arrowSize
    );
  const alignLeft = () =>
    alignAlongEdge(
      requiredAlignment,
      elementDimensions.left,
      elementDimensions.width,
      popoverDimensions.realWidth,
      bounds.left,
      bounds.right,
      popoverPadding,
      arrowSize
    );

  const noneOptimal = !isTopOptimal && !isBottomOptimal && !isLeftOptimal && !isRightOptimal;
  let popoverRenderedSide: Placement = requiredSide;

  if (requiredSide === "top" && isTopOptimal) {
    isRightOptimal = isLeftOptimal = isBottomOptimal = false;
  } else if (requiredSide === "bottom" && isBottomOptimal) {
    isRightOptimal = isLeftOptimal = isTopOptimal = false;
  } else if (requiredSide === "left" && isLeftOptimal) {
    isRightOptimal = isTopOptimal = isBottomOptimal = false;
  } else if (requiredSide === "right" && isRightOptimal) {
    isLeftOptimal = isTopOptimal = isBottomOptimal = false;
  }

  const place = (edge: Side, value?: number) => {
    style[edge] = value === undefined ? "auto" : `${value}px`;
  };
  const centeredLeft = window.innerWidth / 2 - popoverDimensions.realWidth / 2;
  const maxLeft = bounds.right - popoverDimensions.realWidth - arrowSize;
  const maxTop = bounds.bottom - popoverDimensions.realHeight - arrowSize;
  const maxRight = window.innerWidth - bounds.left - popoverDimensions.realWidth - arrowSize;
  const maxBottom = window.innerHeight - bounds.top - popoverDimensions.realHeight - arrowSize;

  if (requiredSide === "over") {
    place("left", centeredLeft);
    place("right");
    place("top", window.innerHeight / 2 - popoverDimensions.realHeight / 2);
    place("bottom");
  } else if (noneOptimal) {
    place("left", centeredLeft);
    place("right");
    place("bottom", 10);
    place("top");
  } else if (isLeftOptimal) {
    place("left", Math.min(leftValue, maxLeft));
    place("top", alignTop());
    place("bottom");
    place("right");

    popoverRenderedSide = "left";
  } else if (isRightOptimal) {
    place("right", Math.min(rightValue, maxRight));
    place("top", alignTop());
    place("bottom");
    place("left");

    popoverRenderedSide = "right";
  } else if (isTopOptimal) {
    place("top", Math.min(topValue, maxTop));
    place("left", alignLeft());
    place("bottom");
    place("right");

    popoverRenderedSide = "top";
  } else if (isBottomOptimal) {
    place("left", alignLeft());
    place("bottom", Math.min(bottomValue, maxBottom));
    place("top");
    place("right");

    popoverRenderedSide = "bottom";
  }

  if (options.strategy === "absolute" && requiredSide !== "over") {
    toAbsolute(popover.wrapper, popoverDimensions.realWidth, popoverDimensions.realHeight);
  }

  renderPopoverArrow(popover, noneOptimal ? "over" : popoverRenderedSide, requiredAlignment, elementDimensions);

  const sideClass = popoverNames.sideClass(popoverRenderedSide);
  const alignClass = popoverNames.alignClass(requiredAlignment);
  [...classList]
    .filter(className => className.startsWith(popoverNames.sidePrefix) || className.startsWith(popoverNames.alignPrefix))
    .filter(className => className !== sideClass && className !== alignClass)
    .forEach(className => classList.remove(className));

  if (!classList.contains(sideClass)) {
    classList.add(sideClass);
  }
  if (!classList.contains(alignClass)) {
    classList.add(alignClass);
  }
  if (options.sideAttribute) {
    popover.wrapper.setAttribute(options.sideAttribute, popoverRenderedSide);
  }

  return {
    side: popoverRenderedSide,
    align: requiredAlignment,
    wrapperRect: popover.wrapper.getBoundingClientRect(),
    targetRect: (options.hasTarget === undefined ? options.centered : !options.hasTarget) ? null : elementDimensions,
  };
}

export const ARROW_SIZE = 10;

export const ARROW_CORNER_INSET = 15;

export function calculateArrowTarget(
  elementStart: number,
  elementEnd: number,
  popoverStart: number,
  popoverEnd: number,
  alignment: Alignment,
  arrowSize: number = ARROW_SIZE
): number {
  const popoverLength = popoverEnd - popoverStart;
  const fullySpansPopover = elementStart <= popoverStart && elementEnd >= popoverEnd;

  if (fullySpansPopover) {
    if (alignment === "start") {
      return ARROW_CORNER_INSET + arrowSize / 2;
    }

    if (alignment === "end") {
      return popoverLength - ARROW_CORNER_INSET - arrowSize / 2;
    }

    return popoverLength / 2;
  }

  const overlapStart = Math.min(Math.max(elementStart, popoverStart), popoverEnd);
  const overlapEnd = Math.min(Math.max(elementEnd, popoverStart), popoverEnd);

  return (overlapStart + overlapEnd) / 2 - popoverStart;
}

export function calculateArrowOffset(
  targetCenter: number,
  popoverLength: number,
  arrowSize: number = ARROW_SIZE
): number {
  const minOffset = ARROW_CORNER_INSET;
  const maxOffset = popoverLength - ARROW_CORNER_INSET - arrowSize;

  if (maxOffset < minOffset) {
    return Math.max(0, (popoverLength - arrowSize) / 2);
  }

  const offset = targetCenter - arrowSize / 2;
  return Math.min(Math.max(offset, minOffset), maxOffset);
}

export function resolveArrowSide(
  side: Side,
  element: { top: number; bottom: number; left: number; right: number },
  popover: { top: number; bottom: number; left: number; right: number }
): Side {
  if (side === "left" || side === "right") {
    const overlapsVertically = element.bottom > popover.top && element.top < popover.bottom;
    if (overlapsVertically) {
      return side;
    }

    return element.bottom <= popover.top ? "bottom" : "top";
  }

  const overlapsHorizontally = element.right > popover.left && element.left < popover.right;
  if (overlapsHorizontally) {
    return side;
  }

  return element.right <= popover.left ? "right" : "left";
}

function renderPopoverArrow(popover: PopoverDOM, side: Placement, alignment: Alignment, elementRect: DOMRect) {
  const popoverArrow = popover.arrow;

  popoverArrow.className = popoverNames.arrow;
  popoverArrow.style.top = "";
  popoverArrow.style.right = "";
  popoverArrow.style.bottom = "";
  popoverArrow.style.left = "";

  if (side === "over") {
    popoverArrow.classList.add(popoverNames.arrowNone);
    return;
  }

  const popoverRect = popover.wrapper.getBoundingClientRect();
  const arrowSize = popoverArrow.getBoundingClientRect().width || ARROW_SIZE;

  const arrowSide = resolveArrowSide(side, elementRect, popoverRect);

  popoverArrow.classList.add(popoverNames.arrowSideClass(arrowSide));

  if (arrowSide === "left" || arrowSide === "right") {
    const target = calculateArrowTarget(
      elementRect.top,
      elementRect.bottom,
      popoverRect.top,
      popoverRect.bottom,
      alignment,
      arrowSize
    );
    popoverArrow.style.top = `${calculateArrowOffset(target, popoverRect.height, arrowSize)}px`;
  } else {
    const target = calculateArrowTarget(
      elementRect.left,
      elementRect.right,
      popoverRect.left,
      popoverRect.right,
      alignment,
      arrowSize
    );
    popoverArrow.style.left = `${calculateArrowOffset(target, popoverRect.width, arrowSize)}px`;
  }
}
