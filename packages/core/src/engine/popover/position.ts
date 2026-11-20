import type { Alignment, Placement, PlacementRequest, PopoverDOM, Side } from "./popover";
import type { PhysicalAlign, RepositionInfo } from "../types";
import { fixedNames } from "../core/namespace";
import { isRtl } from "../core/env";
import { clipRectByScrollParents } from "../core/utils";

const popoverNames = fixedNames.popover;

export type PositionOptions = {
  side: PlacementRequest;
  align: Alignment;
  offset: number;
  crossOffset?: number | undefined;
  arrow?: boolean | undefined;
  arrowMinInset?: number | undefined;
  padding: number;
  boundaryPadding?: number;
  boundary?: "viewport" | "scrollParents" | undefined;
  flip?: boolean | undefined;
  shift?: boolean | undefined;
  hasTarget: boolean;
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

const EXPLICIT_FALLBACK: Side[] = ["left", "right", "top", "bottom"];
const EXPLICIT_FALLBACK_RTL: Side[] = ["right", "left", "top", "bottom"];
const AUTO_ORDER: Side[] = ["bottom", "top", "right", "left"];
const AUTO_ORDER_RTL: Side[] = ["bottom", "top", "left", "right"];

const mirror = (alignment: Alignment): Alignment =>
  alignment === "start" ? "end" : alignment === "end" ? "start" : alignment;

const insetBounds = (b: Bounds, by: number): Bounds => ({
  left: b.left + by,
  top: b.top + by,
  right: b.right - by,
  bottom: b.bottom - by,
});

function resolveBounds(
  anchor: Element,
  options: PositionOptions,
  centered: boolean,
  needWidth: number,
  needHeight: number
): { viewport: Bounds; scroller: Bounds } {
  const inset = options.boundaryPadding || 0;
  const viewport = {
    left: inset,
    top: inset,
    right: window.innerWidth - inset,
    bottom: window.innerHeight - inset,
  };

  if (centered || options.boundary === "viewport") {
    return { viewport, scroller: viewport };
  }

  const clipped = clipRectByScrollParents(anchor, new DOMRect(0, 0, window.innerWidth, window.innerHeight), true);
  const scroller = { ...viewport };

  if (clipped.width - 2 * inset >= needWidth) {
    scroller.left = Math.max(viewport.left, clipped.left + inset);
    scroller.right = Math.min(viewport.right, clipped.right - inset);
  }

  if (clipped.height - 2 * inset >= needHeight) {
    scroller.top = Math.max(viewport.top, clipped.top + inset);
    scroller.bottom = Math.min(viewport.bottom, clipped.bottom - inset);
  }

  return { viewport, scroller };
}

function rawAlignedStart(
  alignment: Alignment,
  elementStart: number,
  elementSize: number,
  popoverSize: number,
  padding: number
): number {
  if (alignment === "start") {
    return elementStart - padding;
  }
  if (alignment === "end") {
    return elementStart - popoverSize + elementSize + padding;
  }

  return elementStart + elementSize / 2 - popoverSize / 2;
}

function clampAlongEdge(start: number, popoverSize: number, boundsStart: number, boundsEnd: number): number {
  return Math.max(Math.min(start, boundsEnd - popoverSize), boundsStart);
}

function freeSpace(side: Side, element: Bounds, bounds: Bounds): number {
  if (side === "top") {
    return element.top - bounds.top;
  }
  if (side === "bottom") {
    return bounds.bottom - element.bottom;
  }
  if (side === "left") {
    return element.left - bounds.left;
  }

  return bounds.right - element.right;
}

function sidesByFreeSpace(element: Bounds, bounds: Bounds, rtl: boolean): Side[] {
  return (rtl ? AUTO_ORDER_RTL : AUTO_ORDER).map((side, index) => ({ side, index, space: freeSpace(side, element, bounds) }))
    .sort((a, b) => b.space - a.space || a.index - b.index)
    .map(entry => entry.side);
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
  const { align: requiredAlignment } = options;
  const flip = options.flip !== false;
  const shift = options.shift !== false;
  const centered = !options.hasTarget || options.side === "over";
  const popoverPadding = options.padding;
  const { style, classList } = popover.wrapper;
  const rtl = isRtl(anchor);
  if (isRtl(popover.wrapper) !== rtl) {
    popover.wrapper.setAttribute("dir", rtl ? "rtl" : "ltr");
  }
  const showArrow = options.arrow !== false;
  const crossOffset = Number.isFinite(options.crossOffset) ? (options.crossOffset as number) : 0;
  if (popover.wrapper.hasAttribute(fixedNames.attr.strategy)) {
    popover.wrapper.removeAttribute(fixedNames.attr.strategy);
    style.left = style.top = style.right = style.bottom = "";
  }

  const popoverDimensions = getPopoverDimensions(popover, options.offset);
  const popoverArrowDimensions = popover.arrow.getBoundingClientRect();
  const elementDimensions = anchor.getBoundingClientRect();
  const arrowSize = showArrow ? popoverArrowDimensions.width || ARROW_SIZE : 0;

  const edgeRoom = arrowSize * 2;
  const { viewport, scroller } = resolveBounds(
    anchor,
    options,
    centered,
    popoverDimensions.realWidth + edgeRoom,
    popoverDimensions.realHeight + edgeRoom
  );

  const topValue = elementDimensions.top - popoverDimensions.height;
  const bottomValue = window.innerHeight - (elementDimensions.bottom + popoverDimensions.height);
  const leftValue = elementDimensions.left - popoverDimensions.width;
  const rightValue = window.innerWidth - (elementDimensions.right + popoverDimensions.width);

  const fitsIn = (b: Bounds): Record<Side, boolean> => ({
    top: topValue >= b.top,
    bottom: bottomValue >= window.innerHeight - b.bottom,
    left: leftValue >= b.left,
    right: rightValue >= window.innerWidth - b.right,
  });

  const autoOrder = options.side === "auto" && !centered ? sidesByFreeSpace(elementDimensions, scroller, rtl) : undefined;
  const requestedSide: Placement = centered ? "over" : (autoOrder?.[0] ?? (options.side as Placement));

  let bounds = scroller;
  let renderedSide: Placement = requestedSide;
  let fellBack = false;

  if (requestedSide !== "over") {
    const fitScroller = fitsIn(scroller);
    const fitViewport = scroller === viewport ? fitScroller : fitsIn(viewport);
    const viewportOrder =
      autoOrder && scroller !== viewport ? sidesByFreeSpace(elementDimensions, viewport, rtl) : autoOrder;
    const pick = (fit: Record<Side, boolean>, order: Side[] | undefined): Side | undefined => {
      const preferred = order?.[0] ?? requestedSide;
      const chain = order ?? (rtl ? EXPLICIT_FALLBACK_RTL : EXPLICIT_FALLBACK);

      return fit[preferred] ? preferred : chain.find(candidate => fit[candidate]);
    };

    if (!flip) {
      bounds = fitScroller[requestedSide] || !fitViewport[requestedSide] ? scroller : viewport;
    } else {
      const inScroller = pick(fitScroller, autoOrder);
      const inViewport =
        inScroller === undefined && scroller !== viewport ? pick(fitViewport, viewportOrder) : undefined;
      if (inScroller !== undefined) {
        renderedSide = inScroller;
      } else if (inViewport !== undefined) {
        renderedSide = inViewport;
        bounds = viewport;
      } else {
        fellBack = true;
        bounds = viewport;
      }
    }
  } else {
    bounds = viewport;
  }

  const margined = insetBounds(bounds, arrowSize);

  const alignAlong = (
    elementStart: number,
    elementSize: number,
    popoverSize: number,
    start: number,
    end: number,
    mirrored: boolean
  ) => {
    const shiftBy = mirrored ? -crossOffset : crossOffset;
    const rawFor = (alignment: Alignment) =>
      rawAlignedStart(mirrored ? mirror(alignment) : alignment, elementStart, elementSize, popoverSize, popoverPadding) +
      shiftBy;
    const overflows = (raw: number) => raw < start || raw + popoverSize > end;

    let alignment = requiredAlignment;
    if (flip && alignment !== "center" && overflows(rawFor(alignment))) {
      const opposite: Alignment = alignment === "start" ? "end" : "start";
      if (!overflows(rawFor(opposite))) {
        alignment = opposite;
      }
    }

    const raw = rawFor(alignment);

    return { alignment, value: shift ? clampAlongEdge(raw, popoverSize, start, end) : raw };
  };

  let renderedAlignment: Alignment = requiredAlignment;
  const alignVertically = () =>
    alignAlong(
      elementDimensions.top,
      elementDimensions.height,
      popoverDimensions.realHeight,
      margined.top,
      margined.bottom,
      false
    );
  const alignHorizontally = () =>
    alignAlong(
      elementDimensions.left,
      elementDimensions.width,
      popoverDimensions.realWidth,
      margined.left,
      margined.right,
      rtl
    );

  const place = (edge: Side, value?: number) => {
    style[edge] = value === undefined ? "auto" : `${value}px`;
  };
  const centerIn = (start: number, end: number, size: number, clampStart: number, clampEnd: number) => {
    const centeredStart = (start + end) / 2 - size / 2;

    return shift ? clampAlongEdge(centeredStart, size, clampStart, clampEnd) : centeredStart;
  };
  const clampMax = (value: number, max: number) => (shift ? Math.min(value, max) : value);

  if (requestedSide === "over" || fellBack) {
    place("left", centerIn(bounds.left, bounds.right, popoverDimensions.realWidth, margined.left, margined.right));
    place("right");
    if (requestedSide === "over") {
      place("top", centerIn(bounds.top, bounds.bottom, popoverDimensions.realHeight, margined.top, margined.bottom));
      place("bottom");
    } else {
      place(
        "bottom",
        clampMax(window.innerHeight - margined.bottom, window.innerHeight - margined.top - popoverDimensions.realHeight)
      );
      place("top");
    }
  } else if (renderedSide === "left") {
    place("left", clampMax(leftValue, margined.right - popoverDimensions.realWidth));
    const aligned = alignVertically();
    renderedAlignment = aligned.alignment;
    place("top", aligned.value);
    place("bottom");
    place("right");
  } else if (renderedSide === "right") {
    place("right", clampMax(rightValue, window.innerWidth - margined.left - popoverDimensions.realWidth));
    const aligned = alignVertically();
    renderedAlignment = aligned.alignment;
    place("top", aligned.value);
    place("bottom");
    place("left");
  } else if (renderedSide === "top") {
    place("top", clampMax(topValue, margined.bottom - popoverDimensions.realHeight));
    const aligned = alignHorizontally();
    renderedAlignment = aligned.alignment;
    place("left", aligned.value);
    place("bottom");
    place("right");
  } else {
    const aligned = alignHorizontally();
    renderedAlignment = aligned.alignment;
    place("left", aligned.value);
    place("bottom", clampMax(bottomValue, window.innerHeight - margined.top - popoverDimensions.realHeight));
    place("top");
    place("right");
  }

  if (options.strategy === "absolute" && requestedSide !== "over") {
    toAbsolute(popover.wrapper, popoverDimensions.realWidth, popoverDimensions.realHeight);
  }

  classList.toggle(popoverNames.rtl, rtl);
  classList.toggle(fixedNames.noArrow, !showArrow);

  renderPopoverArrow(popover, fellBack ? "over" : renderedSide, {
    alignment: renderedAlignment,
    rtl,
    elementRect: elementDimensions,
    showArrow,
    minInset: Number.isFinite(options.arrowMinInset) ? Math.max(0, options.arrowMinInset as number) : ARROW_CORNER_INSET,
  });

  const sideClass = popoverNames.sideClass(renderedSide);
  const alignClass = popoverNames.alignClass(renderedAlignment);
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
    popover.wrapper.setAttribute(options.sideAttribute, renderedSide);
  }

  const wrapperRect = popover.wrapper.getBoundingClientRect();

  return {
    side: renderedSide,
    align: renderedAlignment,
    physicalAlign: physicalAlignment(fellBack ? "over" : renderedSide, renderedAlignment, rtl),
    pinned: fellBack,
    rtl,
    wrapperRect,
    bubbleRect: popover.bubble ? popover.bubble.getBoundingClientRect() : wrapperRect,
    targetRect: options.hasTarget ? elementDimensions : null,
  };
}

function physicalAlignment(side: Placement, alignment: Alignment, rtl: boolean): PhysicalAlign {
  if (side === "over" || alignment === "center") {
    return "center";
  }
  if (side === "left" || side === "right") {
    return alignment === "start" ? "top" : "bottom";
  }

  return (alignment === "start") !== rtl ? "left" : "right";
}

export function arrowClassName(popover: PopoverDOM): string {
  return popover.bubble ? `${popoverNames.arrow} ${fixedNames.bubbleTail}` : popoverNames.arrow;
}

export const ARROW_SIZE = 10;

export const ARROW_CORNER_INSET = 15;

export function calculateArrowTarget(
  elementStart: number,
  elementEnd: number,
  popoverStart: number,
  popoverEnd: number,
  alignment: Alignment,
  arrowSize: number = ARROW_SIZE,
  minInset: number = ARROW_CORNER_INSET
): number {
  const popoverLength = popoverEnd - popoverStart;
  const fullySpansPopover = elementStart <= popoverStart && elementEnd >= popoverEnd;

  if (fullySpansPopover) {
    if (alignment === "start") {
      return minInset + arrowSize / 2;
    }

    if (alignment === "end") {
      return popoverLength - minInset - arrowSize / 2;
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
  arrowSize: number = ARROW_SIZE,
  minInset: number = ARROW_CORNER_INSET
): number {
  const minOffset = minInset;
  const maxOffset = popoverLength - minInset - arrowSize;

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

type ArrowRender = { alignment: Alignment; rtl: boolean; elementRect: DOMRect; showArrow: boolean; minInset: number };

function renderPopoverArrow(popover: PopoverDOM, side: Placement, render: ArrowRender) {
  const { elementRect, showArrow, minInset } = render;
  const popoverArrow = popover.arrow;

  popoverArrow.className = arrowClassName(popover);
  popoverArrow.style.top = "";
  popoverArrow.style.right = "";
  popoverArrow.style.bottom = "";
  popoverArrow.style.left = "";

  if (side === "over" || !showArrow) {
    popoverArrow.classList.add(popoverNames.arrowNone);
    return;
  }

  const wrapperRect = popover.wrapper.getBoundingClientRect();
  const popoverRect = popover.bubble ? popover.bubble.getBoundingClientRect() : wrapperRect;
  const arrowSize = popoverArrow.getBoundingClientRect().width || ARROW_SIZE;

  const arrowSide = resolveArrowSide(side, elementRect, popoverRect);

  popoverArrow.classList.add(popoverNames.arrowSideClass(arrowSide));

  if (arrowSide === "left" || arrowSide === "right") {
    const target = calculateArrowTarget(
      elementRect.top,
      elementRect.bottom,
      popoverRect.top,
      popoverRect.bottom,
      render.alignment,
      arrowSize,
      minInset
    );
    popoverArrow.style.top = `${calculateArrowOffset(target, popoverRect.height, arrowSize, minInset) + popoverRect.top - wrapperRect.top}px`;
  } else {
    const target = calculateArrowTarget(
      elementRect.left,
      elementRect.right,
      popoverRect.left,
      popoverRect.right,
      render.rtl ? mirror(render.alignment) : render.alignment,
      arrowSize,
      minInset
    );
    popoverArrow.style.left = `${calculateArrowOffset(target, popoverRect.width, arrowSize, minInset) + popoverRect.left - wrapperRect.left}px`;
  }

  if (popover.bubble) {
    anchorArrowToBubble(popoverArrow, arrowSide, popoverRect, wrapperRect);
  }
}

function anchorArrowToBubble(arrow: HTMLElement, side: Side, bubble: DOMRect, wrapper: DOMRect) {
  const { style } = arrow;
  if (side === "left") {
    style.left = `${bubble.right - wrapper.left}px`;
  } else if (side === "right") {
    style.right = `${wrapper.right - bubble.left}px`;
  } else if (side === "top") {
    style.top = `${bubble.bottom - wrapper.top}px`;
  } else {
    style.bottom = `${wrapper.bottom - bubble.top}px`;
  }
}
