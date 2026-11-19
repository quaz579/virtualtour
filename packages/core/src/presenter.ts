import { names } from "./engine/core/namespace";
import type { PopoverDOM } from "./engine/popover/popover";
import { focusFirstButton, syncFooter } from "./render/buttons";
import type { Sanitizer } from "./render/content";
import { applyAttrs, mountBody, unmountBody } from "./render/parts";
import type { TourStep } from "./step";
import type { Presenter, RepositionInfo, StepParts } from "./types";
import type { Tour } from "./tour";

const DIALOG_CLASS = "vt-dialog";

/** The default presenter: marks the popover wrapper as a dialog, renders the body element and the custom footer buttons, and records the step index on the wrapper. */
export class DialogPresenter implements Presenter {
  readonly layout = "dialog" as const;
  private readonly tour: Tour;
  private readonly stepAttr: string;
  private readonly sanitize: Sanitizer;
  private parts: StepParts | null = null;
  private content: Element | DocumentFragment | undefined;

  constructor(tour: Tour, namespace: string, sanitize?: (html: string) => string) {
    this.tour = tour;
    this.stepAttr = names(namespace).stepAttr;
    this.sanitize = sanitize;
  }

  mount(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    this.parts = parts;
    this.content = undefined;
    popover.wrapper.classList.add(DIALOG_CLASS);
    popover.wrapper.setAttribute(this.stepAttr, String(this.tour.steps.indexOf(step)));
    this.render(popover, step, parts);
  }

  afterShow(_popover: PopoverDOM, step: TourStep): void {
    if (step.config.focus === "first-button" && this.parts) focusFirstButton(this.parts);
  }

  afterReposition(_popover: PopoverDOM, _step: TourStep, _info: RepositionInfo): void {}

  update(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    this.parts = parts;
    this.render(popover, step, parts);
  }

  beforeLeave(_step: TourStep): void {}

  unmount(): void {
    this.parts = null;
    this.content = undefined;
  }

  private render(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    this.syncBody(popover, step, parts);
    this.syncButtons(popover, step, parts);
    this.applyCloseAttrs(popover, step);
  }

  private syncBody(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    const content = parts.content;
    if (content === this.content && (content === undefined || popover.body?.isConnected)) return;
    unmountBody(popover);
    delete parts.body;
    this.content = content;
    if (!content) return;
    try {
      parts.body = mountBody(popover, content);
    } catch (error) {
      console.warn(`[virtualtour] Step "${step.id}" body could not be mounted.`, error);
    }
  }

  private syncButtons(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    try {
      syncFooter(popover, parts, this.tour, step, step.config.buttons, this.sanitize);
    } catch (error) {
      console.warn(`[virtualtour] Step "${step.id}" buttons could not be rendered.`, error);
    }
  }

  private applyCloseAttrs(popover: PopoverDOM, step: TourStep): void {
    const close = step.config.closeButton;
    if (typeof close === "object" && popover.closeButton) applyAttrs(popover.closeButton, close.attrs);
  }
}
