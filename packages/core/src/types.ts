import type { PopoverDOM } from "./engine/popover/popover";
import type { Tour } from "./tour";
import type { TourStep } from "./step";

/** Any value that survives `JSON.stringify` unchanged. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Side of the target the popover sits on. */
export type Side = "top" | "bottom" | "left" | "right";

/** Alignment of the popover along the chosen side. */
export type Align = "start" | "center" | "end";

/** Corner radii of a rounded rectangle, in CSS pixels. Unset corners keep the default. */
export interface CornerRadius {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
}

/** Appearance and behavior of the dimmed overlay around the highlighted element. */
export interface DimConfig {
  /** Space between the target and the cut-out edge. Default 10. */
  padding?: number;
  /** Cut-out corner radius, uniform or per corner. Default 5. */
  radius?: number | CornerRadius;
  /** Duration of the cut-out transition between steps, in milliseconds. Default 400. */
  transitionMs?: number;
  /** Overlay color. Default `#000`. */
  color?: string;
  /** Overlay opacity from 0 to 1. Default 0.7. */
  opacity?: number;
  /** What a click on the dimmed area does. Default `none`: the click is swallowed. */
  clickOutside?: "none" | "exit" | "forward";
  /** Whether the page can scroll while a step is shown. Default true. */
  pageScroll?: boolean;
  /** Freeze the target's scroll parent while a step is shown. Default false. */
  lockScrollParent?: boolean;
  /** Cut out only the part of the target that its scroll parents leave visible. Default true. */
  clipToScrollParents?: boolean;
}

/**
 * Content of a body: HTML string, list of paragraphs (one `<p>` each), element, document fragment, or a function
 * returning one of them, evaluated each time the step is shown. An element or fragment is deep-cloned into the
 * popover each time the step mounts, so the original is never moved or emptied and stays valid for later mounts;
 * the clone has no event listeners or script-set state, and it is not passed through `sanitize`.
 */
export type BodyContent =
  | string
  | string[]
  | Element
  | DocumentFragment
  | (() => string | string[] | Element | DocumentFragment);

/** The element a step points at: selector, element, or a function returning either. */
export type TargetRef = string | Element | (() => string | Element | null | undefined);

/** Where the popover sits relative to the target. */
export type PlacementRef = "auto" | { side: Side | "auto" | "over"; align?: Align };

/** Popover positioning switches. */
export interface PositionOptions {
  /** Gap between target and popover, or `{ main, cross }`. Main default 10, cross default 0. */
  offset?: number | { main?: number; cross?: number };
  /** Distance kept from the boundary. Default 0. */
  viewportPadding?: number;
  /**
   * What the popover must stay inside. `scrollParents` is the viewport narrowed by the target's scrolling ancestors, so
   * a target inside a scroller keeps its popover inside that scroller; `viewport` ignores scrollers. Default `scrollParents`.
   */
  boundary?: "viewport" | "scrollParents";
  /** Fall back to another side or alignment when the popover does not fit. Default true. */
  flip?: boolean;
  /** Slide along the edge to stay inside the boundary. Default true. */
  shift?: boolean;
  /** CSS positioning strategy. Default `fixed`. */
  strategy?: "fixed" | "absolute";
  /** `false` hides the arrow; `{ minInset }` sets the closest the arrow gets to a corner. Default true, 15. */
  arrow?: boolean | { minInset?: number };
}

/** Per-step cut-out options. */
export interface SpotlightOptions {
  /** Overrides `dim.padding` for this step. */
  padding?: number;
  /** Overrides `dim.radius` for this step. */
  radius?: number | CornerRadius;
  /**
   * Extra selectors to cut out and keep interactive. They also receive the state classes; the matches are
   * re-resolved when the popover repositions (resize, scroll, `refresh()`, a re-bound target), so an extra rendered
   * later is classed only after the next reposition, while the engine cut-out picks it up on its own.
   */
  extra?: string[];
  /** Class added to the target and the extras. */
  class?: string;
  /** `false` blocks all interaction with the target; `hover-only` allows hover but not clicks. Default true. */
  targetInteractive?: boolean | "hover-only";
}

/** Minimal shape of a tour as seen by the compiler. */
export interface TourLike {
  readonly id: string;
}

/** Minimal shape of a step as seen by the compiler. */
export interface TourStepLike {
  readonly id: string;
  readonly config: Readonly<StepConfig>;
  readonly resolvedTarget: Element | null;
}

/** Context passed to a function button action. */
export interface ButtonContext {
  tour: Tour;
  step: TourStep;
}

/** A custom footer button. */
export interface ButtonConfig {
  text: string | (() => string);
  label?: string | (() => string);
  action: "forward" | "backward" | "exit" | "finish" | ((ctx: ButtonContext) => void);
  disabled?: boolean | (() => boolean);
  kind?: "primary" | "secondary";
  classes?: string | string[];
  attrs?: Record<string, string>;
}

/** Configuration of one tour step. */
export interface StepConfig {
  id?: string;
  title?: string | (() => string);
  body?: BodyContent;
  /** Accessible name used when the step has no title. */
  label?: string | (() => string);
  closeButton?: boolean | { label?: string | (() => string); attrs?: Record<string, string> };
  classes?: string | string[];
  /** Caller data, never interpreted. */
  meta?: JsonValue;
  /** Custom footer buttons; when set, the next and back buttons are hidden. */
  buttons?: ButtonConfig[];
  target?: TargetRef;
  /** Absent with a target: highlight the target and center the popover. Absent without a target: centered. */
  placement?: PlacementRef;
  position?: PositionOptions;
  /** Milliseconds to wait for the target to appear. */
  waitFor?: number;
  /** What to do when the target never appears. Default `center`. */
  whenMissing?: "center" | "skip";
  shouldShow?: () => boolean;
  prepare?: () => Promise<unknown> | unknown;
  /**
   * Milliseconds `prepare` and `revealWith` may each take to settle. When one runs longer a warning is logged and the
   * step shows anyway, as it does when the hook throws. `0` or `Infinity` waits forever. Default 10000.
   */
  hookTimeout?: number;
  spotlight?: SpotlightOptions;
  /** How the target is scrolled into view. Default true. */
  reveal?: boolean | "smooth" | ScrollIntoViewOptions;
  /** Replaces the built-in scrolling. */
  revealWith?: (target: Element) => void | Promise<void>;
  /**
   * Moves on when the user does something. With `selector`, the first matching `event` in the document advances the tour after
   * the page's own handlers ran, and `strict` is ignored. Without `selector`, the engine advances on `event` at the target.
   */
  autoAdvance?: { event: string | string[]; selector?: string; strict?: boolean };
  /** Action step: what the user must do before moving on. */
  instruction?: string | (() => string);
  /** Milliseconds to stay on a completed action step before moving on. */
  advanceDelay?: number;
  focus?: "dialog" | "first-button";
  /** Namespaced bag for presenters. */
  extensions?: Record<string, unknown>;
}

/** One saved progress entry for a tour. */
export interface ProgressRecord {
  tourId: string;
  lastStepId?: string;
  completedAt?: string;
  exitedAt?: string;
  updatedAt: string;
}

/** Where progress is kept between page loads. */
export interface ProgressStore {
  load(tourId: string): Promise<ProgressRecord | null> | ProgressRecord | null;
  save(record: ProgressRecord): Promise<void> | void;
  clear(tourId: string): Promise<void> | void;
}

/** Progress persistence options. */
export interface ProgressConfig {
  store: ProgressStore;
  /** Skip a tour the user already finished. Default true. */
  skipCompleted?: boolean;
  /** Start at the last step shown. Default false. */
  resume?: boolean;
}

/** Elements a presenter may add next to the engine's own popover parts. */
export interface StepParts {
  /** `.vt-body`, only for non-string bodies. */
  body?: HTMLElement;
  /** `.vt-footer`, holding custom buttons. */
  footer?: HTMLElement;
  buttons: HTMLButtonElement[];
  /** The element or fragment a step's body resolved to; the presenter clones it into `.vt-body`. */
  content?: Element | DocumentFragment;
}

/** Where a tour stands: `index` is 1-based and 0 while no step is on screen. */
export interface ProgressInfo {
  index: number;
  total: number;
}

/** Where the popover ended up after positioning. */
export interface RepositionInfo {
  side: Side | "over";
  align: Align;
  wrapperRect: DOMRect;
  /** The visible bubble; equals `wrapperRect` for layouts without one. */
  bubbleRect: DOMRect;
  /** `null` when the step has no real target element. */
  targetRect: DOMRect | null;
}

/** Renders the parts of a step the engine does not draw. Created once per tour run. */
export interface Presenter {
  /** Runs after the popover content is applied and before the popover is positioned. */
  mount(popover: PopoverDOM, step: TourStep, parts: StepParts): void;
  afterShow(popover: PopoverDOM, step: TourStep): void;
  afterReposition(popover: PopoverDOM, step: TourStep, info: RepositionInfo): void;
  /** Re-applies a step whose configuration changed while it is shown. */
  update(popover: PopoverDOM, step: TourStep, parts: StepParts): void;
  beforeLeave(step: TourStep): void;
  unmount(): void;
  /** Which popover layout the engine builds. Default `dialog`. */
  layout?: "dialog" | "speaker";
}

/** Builds the presenter for a tour. */
export type PresenterFactory = (tour: Tour) => Presenter;

/** Configuration of a tour. */
export interface TourConfig {
  /** Defaults to `<name-slug>-<random>`. */
  id?: string;
  name?: string;
  steps?: StepConfig[];
  /** Merged under every step; nested groups merge key by key. */
  stepDefaults?: Partial<StepConfig>;
  /** `true` uses the dim defaults; `false` (the default) draws no overlay. */
  dim?: boolean | DimConfig;
  mountIn?: Element | (() => Element);
  dimMountIn?: Element | (() => Element);
  /** Prefix for classes and data attributes added to page elements. Default `vt`. */
  namespace?: string;
  keys?: { escape?: boolean; arrows?: boolean };
  exitPrompt?: false | string | (() => boolean | Promise<boolean>);
  /** `true` shows "1 of 3"; a function receives the 1-based index and the step count. */
  counter?: boolean | ((index: number, total: number) => string);
  labels?: { next?: string; back?: string; done?: string; close?: string };
  progress?: ProgressConfig;
  /** Replaces the built-in dialog presenter. */
  presenter?: PresenterFactory;
  /** Hook that cleans title and body HTML before it reaches the page. Runs once per HTML string. */
  sanitize?: (html: string) => string;
  animate?: boolean;
  /**
   * Total milliseconds one navigation may spend waiting for targets across consecutive steps with `waitFor`. The first
   * step that waits always gets its full `waitFor`; once the budget is spent, later steps are judged on what is on the page and follow their `whenMissing`. `0` or `Infinity` removes the cap.
   * Default 10000.
   */
  waitBudget?: number;
}
