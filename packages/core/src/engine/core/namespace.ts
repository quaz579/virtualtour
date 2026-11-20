const NAMESPACE_PATTERN = /^[a-zA-Z][\w-]*$/;

const FIXED_PREFIX = "vt";

const attributes = Object.freeze({
  active: "data-vt-active",
  dim: "data-vt-dim",
  fade: "data-vt-fade",
  target: "data-vt-target",
  blocked: "data-vt-blocked",
  raised: "data-vt-raised",
  extra: "data-vt-extra",
  targetParent: "data-vt-target-parent",
  lockScroll: "data-vt-lock-scroll",
  overlay: "data-vt-overlay",
  layer: "data-vt-layer",
  strategy: "data-vt-strategy",
  dock: "data-vt-dock",
});

const popover = Object.freeze({
  root: `${FIXED_PREFIX}-popover`,
  arrow: `${FIXED_PREFIX}-popover-arrow`,
  arrowNone: `${FIXED_PREFIX}-popover-arrow-none`,
  rtl: `${FIXED_PREFIX}-popover-rtl`,
  title: `${FIXED_PREFIX}-popover-title`,
  description: `${FIXED_PREFIX}-popover-description`,
  closeButton: `${FIXED_PREFIX}-popover-close-btn`,
  footer: `${FIXED_PREFIX}-popover-footer`,
  footerButton: `${FIXED_PREFIX}-popover-footer-btn`,
  progress: `${FIXED_PREFIX}-popover-progress-text`,
  navigation: `${FIXED_PREFIX}-popover-navigation-btns`,
  previousButton: `${FIXED_PREFIX}-popover-prev-btn`,
  nextButton: `${FIXED_PREFIX}-popover-next-btn`,
  doneButton: `${FIXED_PREFIX}-popover-done-btn`,
  disabledButton: `${FIXED_PREFIX}-popover-btn-disabled`,
  instruction: `${FIXED_PREFIX}-popover-instruction`,
  instructionText: `${FIXED_PREFIX}-popover-instruction-text`,
  instructionIndicator: `${FIXED_PREFIX}-popover-instruction-indicator`,
  hasInstruction: `${FIXED_PREFIX}-popover-has-instruction`,
  instructionDone: `${FIXED_PREFIX}-popover-instruction-done`,
  feedback: `${FIXED_PREFIX}-popover-feedback`,
  waiting: `${FIXED_PREFIX}-popover-waiting`,
  nudge: `${FIXED_PREFIX}-popover-nudge`,
  sidePrefix: `${FIXED_PREFIX}-popover-side-`,
  alignPrefix: `${FIXED_PREFIX}-popover-align-`,
  contentId: `${FIXED_PREFIX}-popover-content`,
  titleId: `${FIXED_PREFIX}-popover-title`,
  descriptionId: `${FIXED_PREFIX}-popover-description`,
  sideClass: (side: string) => `${FIXED_PREFIX}-popover-side-${side}`,
  alignClass: (alignment: string) => `${FIXED_PREFIX}-popover-align-${alignment}`,
  arrowSideClass: (side: string) => `${FIXED_PREFIX}-popover-arrow-side-${side}`,
});

const fixed = Object.freeze({
  attr: attributes,
  popover,
  noArrow: `${FIXED_PREFIX}-no-arrow`,
  speaker: `${FIXED_PREFIX}-speaker`,
  bubble: `${FIXED_PREFIX}-bubble`,
  bubbleTail: `${FIXED_PREFIX}-bubble-tail`,
  avatarSlot: `${FIXED_PREFIX}-avatar-slot`,
  layer: `${FIXED_PREFIX}-layer`,
  liveRegion: `${FIXED_PREFIX}-live-region`,
  dummyId: `${FIXED_PREFIX}-dummy-element`,
  animationDurationVar: `--${FIXED_PREFIX}-animation-duration`,
  nudgeDurationVar: `--${FIXED_PREFIX}-nudge-duration`,
  nudgeAnimationPrefix: `${FIXED_PREFIX}-nudge`,
});

export const EXTRA_SELECTOR = `[${attributes.extra}]`;

export function isValidNamespace(ns: unknown): ns is string {
  return typeof ns === "string" && NAMESPACE_PATTERN.test(ns);
}

export function names(ns = FIXED_PREFIX) {
  if (!isValidNamespace(ns)) {
    throw new Error(`[virtualtour] Invalid namespace "${String(ns)}": use letters, digits, "_" or "-", starting with a letter.`);
  }

  return Object.freeze({
    namespace: ns,
    active: `${ns}-active`,
    fade: `${ns}-fade`,
    simple: `${ns}-simple`,
    noScroll: `${ns}-no-scroll`,
    target: `${ns}-target`,
    targetBlocked: `${ns}-target-blocked`,
    targetRaised: `${ns}-target-raised`,
    extra: `${ns}-extra`,
    targetParent: `${ns}-target-parent`,
    spotlit: `${ns}-spotlit`,
    overlay: `${ns}-overlay`,
    overlayAnimated: `${ns}-overlay-animated`,
    stepAttr: `data-${ns}-step`,
    sideAttr: `data-${ns}-side`,
    ...fixed,
  });
}

export type Names = ReturnType<typeof names>;

export const fixedNames: Names = names();
