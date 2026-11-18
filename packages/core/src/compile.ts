import { DEFAULT_DIM, DEFAULT_POSITION, DEFAULT_STEP_CONFIG, mergeStepConfig } from "./config";
import type { NormalizedTourConfig } from "./config";
import type { Config, DriveStep, Popover } from "./engine/types";
import type { AllowedButtons, Alignment, Side } from "./engine/popover/popover";
import type { CornerRadius, StepConfig, TourStepLike } from "./types";

type Corners = Required<CornerRadius>;

type ScrollIntoViewValue = false | ScrollIntoViewOptions;

type FutureConfigKeys =
  | "allowEscape"
  | "allowArrowKeys"
  | "overlay"
  | "mountIn"
  | "dimMountIn"
  | "clipStageToScrollParents"
  | "lockScrollParent"
  | "stageRadius";

type FutureStepKeys =
  | "popover"
  | "stagePadding"
  | "stageRadius"
  | "popoverOffset"
  | "popoverCrossOffset"
  | "popoverPadding"
  | "scrollIntoView";

type FuturePopoverKeys = "side" | "label" | "arrow" | "arrowMinInset" | "flip" | "shift" | "strategy";

/** Engine popover options, including the ones the engine reads once the matching milestone-two task lands. */
export type EnginePopover = Omit<Popover, FuturePopoverKeys> & {
  side?: Side | "auto" | "over";
  label?: string;
  arrow?: boolean;
  arrowMinInset?: number;
  flip?: boolean;
  shift?: boolean;
  strategy?: "fixed" | "absolute";
};

/** Engine step options, including the per-step fields the engine gains later. */
export type EngineStep = Omit<DriveStep, FutureStepKeys> & {
  popover?: EnginePopover;
  stagePadding?: number;
  stageRadius?: number | Corners;
  popoverOffset?: number;
  popoverCrossOffset?: number;
  popoverPadding?: number;
  scrollIntoView?: ScrollIntoViewValue;
};

/** Engine config, including the keys the engine gains later. */
export type EngineConfig = Omit<Config, FutureConfigKeys> & {
  allowEscape?: boolean;
  allowArrowKeys?: boolean;
  overlay?: boolean;
  mountIn?: Element | (() => Element);
  dimMountIn?: Element | (() => Element);
  clipStageToScrollParents?: boolean;
  lockScrollParent?: boolean;
  stageRadius?: number | Corners;
};

/** Result of {@link compileTour}. */
export interface CompiledTour {
  /** Engine config without hooks; the tour adds them. */
  base: EngineConfig;
  /** One engine step per tour step, each carrying `data: { vt: step }`. */
  steps: EngineStep[];
}

const CORNER_KEYS = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;

const CLICK_OUTSIDE: Record<"none" | "exit" | "forward", NonNullable<Config["overlayClickBehavior"]>> = {
  none: "none",
  exit: "close",
  forward: "nextStep",
};

const elementFns = new WeakMap<TourStepLike, () => Element>();

function targetFn(step: TourStepLike): () => Element {
  let fn = elementFns.get(step);
  if (!fn) {
    fn = () => step.resolvedTarget as Element;
    elementFns.set(step, fn);
  }
  return fn;
}

function toCorners(radius: number | CornerRadius, fallback: number | CornerRadius): number | Corners {
  if (typeof radius === "number") return radius;
  const out = {} as Corners;
  for (const key of CORNER_KEYS) {
    const fb = typeof fallback === "number" ? fallback : (fallback[key] ?? (DEFAULT_DIM.radius as number));
    out[key] = radius[key] ?? fb;
  }
  return out;
}

function describeBody(body: StepConfig["body"], evaluate: boolean): string | undefined {
  const value = typeof body === "function" ? (evaluate ? body() : undefined) : body;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((p) => `<p>${p}</p>`).join("");
  return undefined;
}

function textOf(value: string | (() => string) | undefined, evaluate: boolean): string | undefined {
  if (typeof value === "function") return evaluate ? value() : undefined;
  return value;
}

function compileStep(
  step: TourStepLike,
  base: Partial<StepConfig>,
  dimRadius: number | Corners,
  evaluate: boolean
): EngineStep {
  const config = mergeStepConfig(base, step.config);
  const hasTarget = config.target !== undefined;
  const position = config.position ?? {};
  const spotlight = config.spotlight ?? {};
  const popover: EnginePopover = {};
  const out: EngineStep = { data: { vt: step } };

  if (hasTarget) out.element = targetFn(step);

  const title = textOf(config.title, evaluate);
  if (title !== undefined) popover.title = title;
  const description = describeBody(config.body, evaluate);
  if (description !== undefined) popover.description = description;
  const label = textOf(config.label, evaluate);
  if (label !== undefined) popover.label = label;
  const instruction = textOf(config.instruction, evaluate);
  if (instruction !== undefined) popover.instruction = instruction;

  const closeButton = config.closeButton;
  const showButtons: AllowedButtons[] = config.buttons !== undefined ? [] : ["next", "previous"];
  if (closeButton !== false) showButtons.push("close");
  popover.showButtons = showButtons;
  if (typeof closeButton === "object") {
    const closeLabel = textOf(closeButton.label, evaluate);
    if (closeLabel !== undefined) popover.closeBtnLabel = closeLabel;
  }

  const classes = Array.isArray(config.classes) ? config.classes.join(" ") : config.classes;
  if (classes) popover.popoverClass = classes;

  const arrow = position.arrow;
  if (arrow === false) popover.arrow = false;
  popover.arrowMinInset = (typeof arrow === "object" ? arrow.minInset : undefined) ?? DEFAULT_POSITION.arrow.minInset;
  popover.flip = position.flip ?? DEFAULT_POSITION.flip;
  popover.shift = position.shift ?? DEFAULT_POSITION.shift;
  popover.strategy = position.strategy ?? DEFAULT_POSITION.strategy;

  const placement = config.placement;
  if (placement === "auto") popover.side = "auto";
  else if (placement !== undefined) {
    popover.side = placement.side;
    if (placement.align !== undefined) popover.align = placement.align as Alignment;
  } else if (hasTarget) popover.side = "over";

  const offset = position.offset;
  out.popoverOffset = typeof offset === "number" ? offset : (offset?.main ?? DEFAULT_POSITION.offset.main);
  out.popoverCrossOffset = typeof offset === "number" ? 0 : (offset?.cross ?? DEFAULT_POSITION.offset.cross);
  out.popoverPadding = position.viewportPadding ?? DEFAULT_POSITION.viewportPadding;

  if (spotlight.padding !== undefined) out.stagePadding = spotlight.padding;
  if (spotlight.radius !== undefined) out.stageRadius = toCorners(spotlight.radius, dimRadius);
  if (spotlight.extra && spotlight.extra.length > 0) out.allowedElements = spotlight.extra.slice();
  if (spotlight.targetInteractive === false) out.disableActiveInteraction = true;
  else if (spotlight.targetInteractive === "hover-only") out.disableActiveInteraction = "clicks";

  if (config.whenMissing === "skip") out.skipMissingElement = true;

  if (config.revealWith !== undefined || config.reveal === false) out.scrollIntoView = false;
  else if (config.reveal === "smooth") out.scrollIntoView = { behavior: "smooth" };
  else if (typeof config.reveal === "object") out.scrollIntoView = { ...config.reveal };

  const auto = config.autoAdvance;
  if (auto && auto.selector === undefined) {
    out.advanceOn = auto.strict === undefined ? auto.event : { event: auto.event, strict: auto.strict };
  }

  if (config.advanceDelay !== undefined) out.advanceDelay = config.advanceDelay;

  out.popover = popover;
  return out;
}

/**
 * Compiles a tour into engine config and one engine step per tour step. Pure: no DOM access, no
 * mutation of the inputs, and equal inputs give deep-equal output. Function-valued title, label,
 * instruction and body are left out; {@link compileStepForShow} evaluates them.
 */
export function compileTour(c: NormalizedTourConfig, steps: readonly TourStepLike[]): CompiledTour {
  const dim = c.dimOptions;
  const base: EngineConfig = {
    namespace: c.namespace,
    animate: c.animate,
    overlay: c.dim,
    stagePadding: dim.padding,
    stageRadius: dim.radius,
    duration: dim.transitionMs,
    overlayColor: dim.color,
    overlayOpacity: dim.opacity,
    overlayClickBehavior: CLICK_OUTSIDE[dim.clickOutside],
    allowScroll: dim.pageScroll,
    lockScrollParent: dim.lockScrollParent,
    clipStageToScrollParents: dim.clipToScrollParents,
    allowEscape: c.keys.escape,
    allowArrowKeys: c.keys.arrows,
    showProgress: c.counter !== false,
    nextBtnText: c.labels.next,
    prevBtnText: c.labels.back,
    doneBtnText: c.labels.done,
    closeBtnLabel: c.labels.close,
  };
  if (c.mountIn !== undefined) base.mountIn = c.mountIn;
  if (c.dimMountIn !== undefined) base.dimMountIn = c.dimMountIn;

  const total = steps.length;
  const counter = c.counter;
  const compiled = steps.map((step, index) => {
    const out = compileStep(step, c.stepDefaults, dim.radius, false);
    if (typeof counter === "function") {
      out.popover = { ...out.popover, progressText: counter(index + 1, total) };
    }
    return out;
  });
  return { base, steps: compiled };
}

/**
 * Compiles one step with its function-valued title, label, instruction and body evaluated.
 * Tour-level fields (the progress text) are not included.
 */
export function compileStepForShow(step: TourStepLike): EngineStep {
  return compileStep(step, DEFAULT_STEP_CONFIG, DEFAULT_DIM.radius, true);
}
