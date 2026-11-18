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

/** Text content of a body: HTML string, list of paragraphs, element, or a function returning one of them. */
export type BodyContent = string | string[] | Element | (() => string | string[] | Element);

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
  /** Extra selectors to cut out and keep interactive. */
  extra?: string[];
  /** Class added to the target and the extras. */
  class?: string;
  /** `false` blocks all interaction with the target; `hover-only` allows hover but not clicks. Default true. */
  targetInteractive?: boolean | "hover-only";
}

/** Minimal shape of a tour as seen by button handlers. */
export interface TourLike {
  readonly id: string;
}

/** Minimal shape of a step as seen by the compiler and button handlers. */
export interface TourStepLike {
  readonly id: string;
  readonly config: Readonly<StepConfig>;
  readonly resolvedTarget: Element | null;
}

/** Context passed to a function button action. */
export interface ButtonContext {
  tour: TourLike;
  step: TourStepLike;
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
  spotlight?: SpotlightOptions;
  /** How the target is scrolled into view. Default true. */
  reveal?: boolean | "smooth" | ScrollIntoViewOptions;
  /** Replaces the built-in scrolling. */
  revealWith?: (target: Element) => void | Promise<void>;
  autoAdvance?: { event: string | string[]; selector?: string; strict?: boolean };
  /** Action step: what the user must do before moving on. */
  instruction?: string | (() => string);
  /** Milliseconds to stay on a completed action step before moving on. */
  advanceDelay?: number;
  focus?: "dialog" | "first-button";
  /** Namespaced bag for presenters. */
  extensions?: Record<string, unknown>;
}

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
  /** Hook that cleans HTML before it reaches the page. */
  sanitize?: (html: string) => string;
  animate?: boolean;
}
