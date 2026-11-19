import type { Alignment, AllowedButtons, Placement, PopoverDOM, Side } from "./popover/popover";
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
  allowClose?: boolean;
  allowScroll?: boolean;
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

  presenter?: EnginePresenter;
  onReposition?: (info: RepositionInfo, opts: HookOpts) => void;

  popoverClass?: string;
  popoverOffset?: number;
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
};

export type Popover = {
  title?: string | undefined;
  description?: string | undefined;
  side?: Side;
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
  popoverOffset?: number;
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
  advance: () => void;
  nudge: (message?: string | PopoverPatch) => void;
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
