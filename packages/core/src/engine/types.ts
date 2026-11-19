import type { Alignment, AllowedButtons, Placement, PopoverDOM } from "./popover/popover";
import type { StageCornerRadius, StageDefinition } from "./overlay/stage";

export type DestroyReason = "done" | "close" | "escape" | "overlay" | "replaced" | "api";

export type HookOpts = {
  config: Config;
  state: State;
  driver: Driver;
  index: number | undefined;

  reason?: DestroyReason;

  signal?: AbortSignal | undefined;
};

/** What `onReposition` and `EnginePresenter.afterReposition` receive after the popover is placed. */
export type RepositionInfo = {
  /** The side the popover was rendered on. */
  side: Placement;
  align: Alignment;
  wrapperRect: DOMRect;
  /** `null` when the step has no real target element. */
  targetRect: DOMRect | null;
};

/** The engine's view of a presenter: it runs while the popover is rendered and positioned. */
export type EnginePresenter = {
  layout?: "dialog" | "speaker";
  /** Runs after the popover content is applied and before the popover is positioned. */
  mount(popover: PopoverDOM, step: DriveStep): void;
  afterReposition?(info: RepositionInfo): void;
};

export type DriverHook = (element: Element | undefined, step: DriveStep, opts: HookOpts) => void;

export type AdvanceOnOpts = HookOpts & {
  event: Event;
};

export type AdvanceOnEvent = {
  event: string | string[];
  when?: (element: Element, step: DriveStep, opts: AdvanceOnOpts) => boolean;

  strict?: boolean;
};

export type AdvanceOn = false | string | string[] | AdvanceOnEvent;

export type AllowedElements =
  | string
  | Element
  | Array<string | Element>
  | (() => Element[] | NodeListOf<Element> | null | undefined);

export type InteractionRegion = "element" | "allowed" | "outside";

export type InteractionOpts = HookOpts & {
  event: MouseEvent;
  region: InteractionRegion;
};

export type InteractionHook = (element: Element | undefined, step: DriveStep, opts: InteractionOpts) => false | void;

export type PopoverPatch = Pick<
  Popover,
  | "title"
  | "description"
  | "label"
  | "showButtons"
  | "disableButtons"
  | "showProgress"
  | "progressText"
  | "nextBtnText"
  | "prevBtnText"
  | "closeBtnLabel"
  | "popoverClass"
  | "instruction"
>;

export type ElementMissingOpts = HookOpts & {
  cause: "removed" | "timeout";
};

export type ElementMissingHook = (
  element: Element | undefined,
  step: DriveStep,
  opts: ElementMissingOpts
) => false | void;

export type ElementMissingPreset = "stay" | "previous" | "previousAction";
export type ElementMissing = ElementMissingPreset | ElementMissingHook;

export type Config = {
  steps?: DriveStep[];

  /**
   * Prefix for the styling classes (`<namespace>-target`, `<namespace>-active`, ...) and the
   * `data-<namespace>-step` and `data-<namespace>-side` attributes added to page elements.
   * Defaults to `vt`. Must match `/^[a-zA-Z][\w-]*$/`. Read once when the engine is created;
   * later `setConfig` calls cannot change it. The mechanism attributes (`data-vt-*`), the popover
   * classes (`vt-popover*`) and the popover ids stay fixed whatever the namespace.
   */
  namespace?: string;

  animate?: boolean;
  duration?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  smoothScroll?: boolean;
  /** Scroll options for bringing the highlighted element into view; `false` never scrolls. Defaults to the engine rule. */
  scrollIntoView?: false | ScrollIntoViewOptions;
  allowClose?: boolean;
  allowScroll?: boolean;
  /**
   * Freezes the scroll position of the highlighted element's scrollable parent while a step is shown.
   * Defaults to `false`: the parent keeps scrolling and the popover and cut-out follow it.
   */
  lockScrollParent?: boolean;
  overlayClickBehavior?: "close" | "nextStep" | "none" | DriverHook;
  stagePadding?: number;
  stageRadius?: number | StageCornerRadius;
  /** Cut out only the part of the highlighted element that its scrolling ancestors show. Defaults to `true`. */
  clipStageToScrollParents?: boolean;

  disableActiveInteraction?: boolean | "clicks";

  advanceOn?: AdvanceOn;
  /** @deprecated Use `advanceOn: "click"`. */
  advanceOnClick?: boolean;
  onInteraction?: InteractionHook;
  allowedElements?: AllowedElements;
  onElementMissing?: ElementMissing;

  skipMissingElement?: boolean;

  waitForElement?: number;

  advanceDelay?: number;

  /** @deprecated Use `allowEscape` and `allowArrowKeys`. `false` disables both. */
  allowKeyboardControl?: boolean;
  /** Whether Escape closes the tour. Defaults to `true`. */
  allowEscape?: boolean;
  /** Whether the arrow keys move between steps. Defaults to `true`. */
  allowArrowKeys?: boolean;
  /** Whether the dimmed overlay is drawn. Defaults to `true`; `false` draws no overlay and no `data-vt-dim`. */
  overlay?: boolean;
  /**
   * Where the popover is inserted instead of `document.body`: an element, or a function returning
   * one at mount time. Must be an element of the current document, outside any shadow root. A step
   * whose target is inside an open `<dialog>` mounts in that dialog and ignores `mountIn`. A container
   * that is a containing block for fixed descendants (transform, filter) offsets the popover.
   */
  mountIn?: Element | (() => Element);
  /**
   * Where the dimmed overlay is inserted instead of `document.body`. Same rules as `mountIn`. Outside
   * `document.body` the overlay is inserted before the container's other children. The
   * overlay stays `position: fixed`, so a container that creates a containing block misplaces it.
   */
  dimMountIn?: Element | (() => Element);

  /** Cleans every HTML string the popover renders: title, description, instruction, feedback, progress text and button text. */
  sanitize?: (html: string) => string;

  presenter?: EnginePresenter;
  onReposition?: (info: RepositionInfo, opts: HookOpts) => void;

  popoverClass?: string;
  popoverOffset?: number;
  /** Gap kept between the popover and the viewport edges, in pixels. Defaults to `0`. */
  popoverPadding?: number;
  /**
   * What the popover must stay inside. `"scrollParents"` (default) is the viewport narrowed by the scrolling
   * ancestors of the target; `"viewport"` is the viewport alone.
   */
  popoverBoundary?: "viewport" | "scrollParents";
  showButtons?: AllowedButtons[];
  disableButtons?: AllowedButtons[];
  showProgress?: boolean;

  progressText?: string;
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
  closeBtnLabel?: string;

  onPopoverRender?: (popover: PopoverDOM, opts: HookOpts) => void;

  onHighlightStarted?: DriverHook;
  onHighlighted?: DriverHook;
  onDeselected?: DriverHook;
  onDestroyStarted?: DriverHook;
  onDestroyed?: DriverHook;

  onNextClick?: DriverHook;
  onPrevClick?: DriverHook;
  onCloseClick?: DriverHook;
  onDoneClick?: DriverHook;

  /** Runs when a step's `advanceOn` fires or `advance()` runs, right after the step is marked done and before any `advanceDelay`. */
  onStepCompleted?: DriverHook;
  /** Runs each time the popover shakes: Next, ArrowRight or the overlay pressed on an unmet action step, or `nudge()`. */
  onNudge?: (step: DriveStep) => void;
};

export type Popover = {
  title?: string | undefined;
  description?: string | undefined;
  label?: string | undefined;
  /** Side of the target the popover sits on. `"over"` keeps the target highlighted and centers the popover. */
  side?: Placement;
  align?: Alignment;

  showButtons?: AllowedButtons[];
  showProgress?: boolean;
  disableButtons?: AllowedButtons[];

  popoverClass?: string | undefined;

  progressText?: string | undefined;
  doneBtnText?: string | undefined;
  nextBtnText?: string | undefined;
  prevBtnText?: string | undefined;
  closeBtnLabel?: string | undefined;

  instruction?: string | undefined;

  /** Let the arrow keys move between steps even when `showButtons` hides Next and Back. They still honor `disableButtons` and the action-step gate. */
  navigateWithKeys?: boolean;

  onPopoverRender?: (popover: PopoverDOM, opts: HookOpts) => void;

  onNextClick?: DriverHook;
  onPrevClick?: DriverHook;
  onCloseClick?: DriverHook;
  onDoneClick?: DriverHook;
};

export type DriveStep = {
  element?: string | Element | (() => Element);
  onHighlightStarted?: DriverHook;
  onHighlighted?: DriverHook;
  onDeselected?: DriverHook;
  popover?: Popover | undefined;
  disableActiveInteraction?: boolean | "clicks";
  advanceOn?: AdvanceOn;
  /** @deprecated Use `advanceOn: "click"`. */
  advanceOnClick?: boolean;
  onInteraction?: InteractionHook;
  allowedElements?: AllowedElements;
  onElementMissing?: ElementMissing;
  skipMissingElement?: boolean;
  waitForElement?: number;
  advanceDelay?: number;
  stagePadding?: number;
  stageRadius?: number | StageCornerRadius;
  clipStageToScrollParents?: boolean;
  /** Scroll options for this step's element; `false` never scrolls. Overrides `Config.scrollIntoView`. */
  scrollIntoView?: false | ScrollIntoViewOptions;
  popoverOffset?: number;
  /** Overrides `Config.popoverPadding` for this step. */
  popoverPadding?: number;
  data?: Record<string, any>;
};

export interface Driver {
  isActive: () => boolean;
  refresh: () => void;
  drive: (stepIndex?: number) => void;
  setConfig: (config: Config) => void;
  setSteps: (steps: DriveStep[]) => void;
  getConfig: () => Config;
  getState: (key?: string) => any;
  getActiveIndex: () => number | undefined;
  isFirstStep: () => boolean;
  isLastStep: () => boolean;
  getActiveStep: () => DriveStep | undefined;
  getActiveElement: () => Element | undefined;
  getPreviousElement: () => Element | undefined;
  getPreviousStep: () => DriveStep | undefined;
  getNextStep: () => DriveStep | undefined;
  moveNext: () => void;
  movePrevious: () => void;
  moveTo: (index: number) => void;
  hasNextStep: () => boolean;
  hasPreviousStep: () => boolean;
  highlight: (step: DriveStep) => void;
  updatePopover: (patch?: PopoverPatch) => void;
  /** Completes the current step as `advanceOn` would; returns `false` when no step can complete (none shown, or still waiting for its element). */
  advance: () => boolean;
  nudge: (message?: string | PopoverPatch) => void;
  /** Nudges and returns `true` when the current step is an action step whose instruction is not yet met; returns `false` and does nothing otherwise. */
  nudgeIfGated: () => boolean;
  destroy: () => void;
}

export type State = {
  isInitialized?: boolean;

  activeIndex?: number;
  activeElement?: Element;
  activeStep?: DriveStep;
  previousElement?: Element;
  previousStep?: DriveStep;

  popover?: PopoverDOM;

  __previousElement?: Element;
  __activeElement?: Element;
  __previousStep?: DriveStep;
  __activeStep?: DriveStep;

  __activeOnDestroyed?: Element;
  __resizeTimeout?: number;
  __transitionCallback?: () => void;
  __pendingWaitCancel?: () => void;

  __destroyReason?: DestroyReason;
  __activeStagePosition?: StageDefinition;
  __overlaySvg?: SVGSVGElement;

  __events?: {
    onKeyup: (e: KeyboardEvent) => void;
    onKeydown: (e: KeyboardEvent) => void;
    onKeydownCapture: (e: KeyboardEvent) => void;
    onResize: () => void;
    onScroll: () => void;
  };
};
