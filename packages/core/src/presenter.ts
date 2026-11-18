import { names } from "./engine/core/namespace";
import type { PopoverDOM } from "./engine/popover/popover";
import { applyAttrs, mountBody } from "./render/parts";
import type { TourStep } from "./step";
import type { Presenter, RepositionInfo, StepParts } from "./types";
import type { Tour } from "./tour";

const DIALOG_CLASS = "vt-dialog";

/** The default presenter: marks the popover wrapper as a dialog and records the step index on it. */
export class DialogPresenter implements Presenter {
  readonly layout = "dialog" as const;
  private readonly tour: Tour;
  private readonly stepAttr: string;

  constructor(tour: Tour, namespace: string) {
    this.tour = tour;
    this.stepAttr = names(namespace).stepAttr;
  }

  mount(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    popover.wrapper.classList.add(DIALOG_CLASS);
    popover.wrapper.setAttribute(this.stepAttr, String(this.tour.steps.indexOf(step)));
    if (parts.content) parts.body = mountBody(popover, parts.content);
    this.applyCloseAttrs(popover, step);
  }

  afterShow(_popover: PopoverDOM, _step: TourStep): void {}

  afterReposition(_popover: PopoverDOM, _step: TourStep, _info: RepositionInfo): void {}

  update(popover: PopoverDOM, step: TourStep, _parts: StepParts): void {
    this.applyCloseAttrs(popover, step);
  }

  beforeLeave(_step: TourStep): void {}

  unmount(): void {}

  private applyCloseAttrs(popover: PopoverDOM, step: TourStep): void {
    const close = step.config.closeButton;
    if (typeof close === "object" && popover.closeButton) applyAttrs(popover.closeButton, close.attrs);
  }
}
