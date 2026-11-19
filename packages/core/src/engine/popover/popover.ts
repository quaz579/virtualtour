import { destroyDriverClick, onDriverClick } from "../core/click";
import { PositionOptions, repositionPopover } from "./position";
import type { DriveStep, EnginePresenter, RepositionInfo } from "../types";
import { bringInView, removeFromLayer } from "../core/utils";
import { fixedNames } from "../core/namespace";

const P = fixedNames.popover;
const PRESSABLE_BUTTONS = [P.previousButton, P.nextButton, P.closeButton].map(name => `.${name}`).join(", ");

export type Side = "top" | "right" | "bottom" | "left";
export type Placement = Side | "over";
export type Alignment = "start" | "center" | "end";
export type AllowedButtons = "next" | "previous" | "close";

export type PopoverDOM = {
  wrapper: HTMLElement;
  arrow: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  footer: HTMLElement;
  progress: HTMLElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  footerButtons: HTMLElement;

  body?: HTMLElement;

  instruction?: HTMLElement;
  instructionIndicator?: HTMLElement;

  feedback?: HTMLElement;
};

export type PopoverRenderOptions = {
  title?: string | undefined;
  description?: string | undefined;
  label?: string | undefined;

  showButtons: AllowedButtons[];
  disableButtons: AllowedButtons[];
  showProgress: boolean;

  progressText: string;
  nextBtnText: string;
  prevBtnText: string;
  closeBtnLabel: string;

  doneButton?: boolean | undefined;

  instruction?: string | undefined;
  isGated?: boolean | undefined;
  isDone?: boolean | undefined;

  feedback?: string | undefined;

  popoverClass?: string | undefined;
  smoothScroll?: boolean | undefined;
  scrollIntoView?: false | undefined;

  onNextClick?: () => void;
  onPrevClick?: () => void;
  onCloseClick?: () => void;

  keepFocus?: boolean;

  onRender?: (popover: PopoverDOM) => void;
  presenter?: EnginePresenter | undefined;
  step?: DriveStep | undefined;
  onPositioned?: (info: RepositionInfo) => void;

  sanitize?: ((html: string) => string) | undefined;

  position: PositionOptions;
};

export function hidePopover(popover: PopoverDOM | undefined) {
  if (!popover) {
    return;
  }

  popover.wrapper.style.display = "none";
}

const customClasses = new WeakMap<HTMLElement, string[]>();
const appliedHtml = new WeakMap<HTMLElement, string>();

function cleanHtml(html: string, sanitize: ((html: string) => string) | undefined): string | undefined {
  if (!sanitize || !html.includes("<")) {
    return html;
  }

  try {
    const clean = sanitize(html);
    return typeof clean === "string" ? clean : undefined;
  } catch {
    return undefined;
  }
}

function setHtml(element: HTMLElement, html: string, sanitize?: (html: string) => string): string {
  const clean = cleanHtml(html, sanitize);
  if (clean === undefined) {
    if (appliedHtml.get(element) !== html) {
      element.textContent = html;
      appliedHtml.set(element, html);
    }
    return "";
  }

  if (appliedHtml.get(element) !== clean) {
    element.innerHTML = clean;
    appliedHtml.set(element, clean);
  }

  return clean;
}

function setDisplay(element: HTMLElement, isVisible: boolean) {
  element.style.display = isVisible ? "" : "none";
}

const focusTakenFrom = new WeakSet<HTMLButtonElement>();

function focusWrapper(wrapper: HTMLElement | null) {
  wrapper?.setAttribute("tabindex", "-1");
  wrapper?.focus();
}

export function toggleButton(button: HTMLButtonElement, isDisabled: boolean) {
  const wrapper = button.closest<HTMLElement>(`.${P.root}`);
  if (isDisabled && document.activeElement === button) {
    focusWrapper(wrapper);
    focusTakenFrom.add(button);
  }

  button.disabled = isDisabled;
  button.classList.toggle(DISABLED_BUTTON, isDisabled);

  if (!isDisabled && focusTakenFrom.delete(button) && wrapper && document.activeElement === wrapper) {
    button.focus();
  }
}

const INSTRUCTION_TEXT = P.instructionText;
const DISABLED_BUTTON = P.disabledButton;

function toggleDescribedBy(wrapper: HTMLElement, id: string, isOn: boolean) {
  const ids = (wrapper.getAttribute("aria-describedby") || "").split(/\s+/).filter(token => token && token !== id);
  if (isOn) {
    ids.push(id);
  }

  wrapper.setAttribute("aria-describedby", ids.join(" "));
}

function insertRow(popover: PopoverDOM, className: string): HTMLElement {
  const row = createElement("div", className);

  const footer = popover.footer.parentNode === popover.wrapper ? popover.footer : null;
  popover.wrapper.insertBefore(row, footer);

  return row;
}

function createInstruction(popover: PopoverDOM) {
  const row = insertRow(popover, P.instruction);
  const indicator = createElement("span", P.instructionIndicator);
  indicator.setAttribute("aria-hidden", "true");
  row.append(createElement("span", INSTRUCTION_TEXT, INSTRUCTION_TEXT), indicator);

  popover.instruction = row;
  popover.instructionIndicator = indicator;
}

function applyInstruction(popover: PopoverDOM, options: PopoverRenderOptions) {
  const sanitize = options.sanitize;
  const isGated = !!options.isGated;
  if ((isGated || options.instruction) && !popover.instruction) {
    createInstruction(popover);
  }

  const { instruction: row, instructionIndicator: indicator, wrapper, nextButton } = popover;
  if (!row || !indicator) {
    return;
  }

  const text = row.querySelector<HTMLElement>(`:scope > .${INSTRUCTION_TEXT}`);
  const html = text && options.instruction ? setHtml(text, options.instruction, sanitize) : "";
  wrapper.classList.toggle(P.hasInstruction, isGated);
  wrapper.classList.toggle(P.instructionDone, isGated && !!options.isDone);
  toggleDescribedBy(wrapper, INSTRUCTION_TEXT, !!html);
  setDisplay(row, !!html);

  if (isGated) {
    nextButton.setAttribute("aria-disabled", "true");
    nextButton.classList.add(DISABLED_BUTTON);
  } else {
    nextButton.removeAttribute("aria-disabled");
  }
}

function applyFeedback(popover: PopoverDOM, options: PopoverRenderOptions) {
  if (options.feedback && !popover.feedback) {
    popover.feedback = insertRow(popover, P.feedback);
  }

  if (!popover.feedback) {
    return;
  }

  const feedback = setHtml(popover.feedback, options.feedback || "", options.sanitize);
  setDisplay(popover.feedback, !!feedback);
}

function applyPopoverContent(popover: PopoverDOM, options: PopoverRenderOptions) {
  const { title, description, showButtons, disableButtons, showProgress, nextBtnText, prevBtnText, progressText } =
    options;

  const sanitize = options.sanitize;
  setHtml(popover.nextButton, nextBtnText, sanitize);
  setHtml(popover.previousButton, prevBtnText, sanitize);
  setHtml(popover.progress, progressText, sanitize);
  popover.closeButton.setAttribute("aria-label", options.closeBtnLabel);
  popover.nextButton.classList.toggle(P.doneButton, !!options.doneButton);

  const titleHtml = setHtml(popover.title, title || "", sanitize);
  const hasTitle = !!titleHtml.trim();
  setDisplay(popover.title, hasTitle);

  const descriptionHtml = setHtml(popover.description, description || "", sanitize);
  setDisplay(popover.description, !!descriptionHtml);

  const labelled = popover.wrapper;
  if (hasTitle) {
    labelled.setAttribute("aria-labelledby", P.titleId);
    labelled.removeAttribute("aria-label");
  } else {
    labelled.removeAttribute("aria-labelledby");
    if (options.label) {
      labelled.setAttribute("aria-label", options.label);
    } else {
      labelled.removeAttribute("aria-label");
    }
  }

  const showFooter = showButtons.includes("next") || showButtons.includes("previous") || showProgress;

  setDisplay(popover.closeButton, showButtons.includes("close"));
  setDisplay(popover.footer, showFooter);
  setDisplay(popover.progress, showProgress);
  setDisplay(popover.nextButton, showButtons.includes("next"));
  setDisplay(popover.previousButton, showButtons.includes("previous"));

  toggleButton(popover.nextButton, disableButtons.includes("next"));
  toggleButton(popover.previousButton, disableButtons.includes("previous"));
  toggleButton(popover.closeButton, disableButtons.includes("close"));
  applyInstruction(popover, options);
  applyFeedback(popover, options);

  const wrapper = popover.wrapper;
  wrapper.classList.remove(...(customClasses.get(wrapper) || []));
  const classes = (options.popoverClass || "").split(/\s+/).filter(Boolean);
  wrapper.classList.add(...classes);
  customClasses.set(wrapper, classes);
}

function isUnreachable(element: Element, root: HTMLElement): boolean {
  if ((element as HTMLButtonElement).disabled) {
    return true;
  }

  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    if ((node as HTMLElement).style?.display === "none") {
      return true;
    }
  }

  return false;
}

export function updatePopoverContent(popover: PopoverDOM, anchor: Element, options: PopoverRenderOptions) {
  const focused = document.activeElement;
  const hadFocus = !!focused && popover.wrapper.contains(focused) && focused !== popover.wrapper;

  applyPopoverContent(popover, options);

  if (hadFocus && (!focused!.isConnected || isUnreachable(focused!, popover.wrapper))) {
    popover.wrapper.setAttribute("tabindex", "-1");
    popover.wrapper.focus();
  }

  options.onPositioned?.(repositionPopover(popover, anchor, options.position));
  repositionOnImagesLoad(popover, anchor, options.position, options.onPositioned);
}

export function renderPopover(anchor: Element, layer: Element, options: PopoverRenderOptions): PopoverDOM {
  const popover = createPopover();
  layer.appendChild(popover.wrapper);

  const popoverWrapper = popover.wrapper;
  popoverWrapper.className = P.root;
  applyPopoverContent(popover, options);

  popoverWrapper.style.display = "block";
  popoverWrapper.style.left = "";
  popoverWrapper.style.top = "";
  popoverWrapper.style.bottom = "";
  popoverWrapper.style.right = "";

  popoverWrapper.id = P.contentId;
  popoverWrapper.setAttribute("role", "dialog");

  popover.arrow.className = P.arrow;

  onDriverClick(
    popover.wrapper,
    e => {
      const target = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
      if (!target) {
        return undefined;
      }

      if (!!target.closest(`.${P.nextButton}`)) {
        return options.onNextClick?.();
      }

      if (!!target.closest(`.${P.previousButton}`)) {
        return options.onPrevClick?.();
      }

      if (!!target.closest(`.${P.closeButton}`)) {
        return options.onCloseClick?.();
      }

      return undefined;
    },
    target => {
      if (popover.description.contains(target) || popover.title.contains(target) || popover.body?.contains(target)) {
        return false;
      }

      return !!target.closest(PRESSABLE_BUTTONS);
    }
  );

  options.onRender?.(popover);
  if (options.presenter && options.step) {
    options.presenter.mount(popover, options.step);
  }

  options.onPositioned?.(repositionPopover(popover, anchor, options.position));
  repositionOnImagesLoad(popover, anchor, options.position, options.onPositioned);
  bringInView(popoverWrapper, options.scrollIntoView === false ? false : undefined, options.smoothScroll);

  if (!options.keepFocus) {
    focusPopover(popover);
  }

  return popover;
}

function focusPopover(popover: PopoverDOM) {
  const { nextButton, wrapper } = popover;
  const isNextUsable =
    nextButton.isConnected &&
    nextButton.style.display !== "none" &&
    !nextButton.disabled &&
    !nextButton.hasAttribute("aria-disabled");
  if (isNextUsable) {
    nextButton.focus();
  }

  if (document.activeElement !== nextButton) {
    focusWrapper(wrapper);
  }
}

type ImageTarget = {
  anchor: Element;
  position: PositionOptions;
  onPositioned: ((info: RepositionInfo) => void) | undefined;
};

const imageTargets = new WeakMap<PopoverDOM, ImageTarget>();
const watchedImages = new WeakSet<HTMLImageElement>();

function repositionOnImagesLoad(
  popover: PopoverDOM,
  anchor: Element,
  position: PositionOptions,
  onPositioned?: (info: RepositionInfo) => void
) {
  imageTargets.set(popover, { anchor, position, onPositioned });

  popover.wrapper.querySelectorAll("img").forEach(image => {
    if (image.complete || watchedImages.has(image)) {
      return;
    }

    watchedImages.add(image);
    const reposition = () => {
      watchedImages.delete(image);
      const target = imageTargets.get(popover);
      if (target && popover.wrapper.isConnected) {
        target.onPositioned?.(repositionPopover(popover, target.anchor, target.position));
      }
    };

    image.addEventListener("load", reposition, { once: true });
    image.addEventListener("error", reposition, { once: true });
  });
}

function createElement<K extends "div" | "span" | "button">(tag: K, className: string, id?: string) {
  const element = document.createElement(tag);
  if (id) {
    element.id = id;
  }

  if (element instanceof HTMLButtonElement) {
    element.type = "button";
  }

  element.className = className;

  return element;
}

function createPopover(): PopoverDOM {
  const wrapper = createElement("div", P.root);
  wrapper.setAttribute("aria-describedby", P.descriptionId);

  const arrow = createElement("div", P.arrow);

  const title = createElement("div", P.title, P.titleId);
  title.style.display = "none";
  title.innerText = "";

  const description = createElement("div", P.description, P.descriptionId);
  description.style.display = "none";
  description.innerText = "";

  const closeButton = createElement("button", P.closeButton);
  closeButton.innerHTML = "&times;";

  const footer = createElement("div", P.footer);
  const progress = createElement("span", P.progress);
  const footerButtons = createElement("span", P.navigation);

  const previousButton = createElement("button", [P.previousButton, P.footerButton].join(" "));
  previousButton.innerHTML = "Previous";

  const nextButton = createElement("button", [P.nextButton, P.footerButton].join(" "));
  nextButton.innerHTML = "Next";

  footerButtons.append(previousButton, nextButton);
  footer.append(progress, footerButtons);
  wrapper.append(closeButton, arrow, title, description, footer);

  return {
    wrapper,
    arrow,
    title,
    description,
    footer,
    previousButton,
    nextButton,
    closeButton,
    footerButtons,
    progress,
  };
}

export function destroyPopover(popover: PopoverDOM | undefined) {
  if (!popover) {
    return;
  }

  destroyDriverClick(popover.wrapper);
  removeFromLayer(popover.wrapper);
}
