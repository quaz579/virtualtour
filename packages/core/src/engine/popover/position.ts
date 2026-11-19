import type { Alignment, Placement, PlacementRequest, PopoverDOM, Side } from "./popover";
import type { RepositionInfo } from "../types";
import { fixedNames } from "../core/namespace";
import { clipRectByScrollParents } from "../core/utils";

const popoverNames = fixedNames.popover;

export type PositionOptions = {
  side: PlacementRequest;
  align: Alignment;
  offset: number;
  padding: number;
  boundaryPadding?: number;
  boundary?: "viewport" | "scrollParents" | undefined;
  flip?: boolean | undefined;
  shift?: boolean | undefined;
  hasTarget: boolean;
  sideAttribute?: string;
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
const AUTO_ORDER: Side[] = ["bottom", "top", "right", "left"];

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

function sidesByFreeSpace(element: Bounds, bounds: Bounds): Side[] {
  return AUTO_ORDER.map((side, index) => ({ side, index, space: freeSpace(side, element, bounds) }))
    .sort((a, b) => b.space - a.space || a.index - b.index)
    .map(entry => entry.side);
}

export function repositionPopover(popover: PopoverDOM, anchor: Element, options: PositionOptions): RepositionInfo {
  const { align: requiredAlignment } = options;
  const flip = options.flip !== false;
  const shift = options.shift !== false;
  const centered = !options.hasTarget || options.side === "over";
  const popoverPadding = options.padding;
  const { style, classList } = popover.wrapper;

  const popoverDimensions = getPopoverDimensions(popover, options.offset);
  const popoverArrowDimensions = popover.arrow.getBoundingClientRect();
  const elementDimensions = anchor.getBoundingClientRect();
  const arrowSize = popoverArrowDimensions.width || ARROW_SIZE;

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

  const autoOrder = options.side === "auto" && !centered ? sidesByFreeSpace(elementDimensions, scroller) : undefined;
  const fallbackChain = autoOrder ?? EXPLICIT_FALLBACK;
  const requestedSide: Placement = centered ? "over" : (autoOrder?.[0] ?? (options.side as Placement));

  let bounds = scroller;
  let renderedSide: Placement = requestedSide;
  let fellBack = false;

  if (requestedSide !== "over") {
    const fitScroller = fitsIn(scroller);
    const fitViewport = scroller === viewport ? fitScroller : fitsIn(viewport);
    const pick = (fit: Record<Side, boolean>): Side | undefined =>
      fit[requestedSide] ? requestedSide : fallbackChain.find(candidate => fit[candidate]);

    if (!flip) {
      bounds = fitScroller[requestedSide] || !fitViewport[requestedSide] ? scroller : viewport;
    } else {
      const inScroller = pick(fitScroller);
      const inViewport = inScroller === undefined && scroller !== viewport ? pick(fitViewport) : undefined;
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

  const alignAlong = (elementStart: number, elementSize: number, popoverSize: number, start: number, end: number) => {
    const rawFor = (alignment: Alignment) =>
      rawAlignedStart(alignment, elementStart, elementSize, popoverSize, popoverPadding);
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
      margined.bottom
    );
  const alignHorizontally = () =>
    alignAlong(
      elementDimensions.left,
      elementDimensions.width,
      popoverDimensions.realWidth,
      margined.left,
      margined.right
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

  renderPopoverArrow(popover, fellBack ? "over" : renderedSide, renderedAlignment, elementDimensions);

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

  return {
    side: renderedSide,
    align: renderedAlignment,
    wrapperRect: popover.wrapper.getBoundingClientRect(),
    targetRect: options.hasTarget ? elementDimensions : null,
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
