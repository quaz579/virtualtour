import { names } from "./engine/core/namespace";
import type { PopoverDOM } from "./engine/popover/popover";
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

  mount(popover: PopoverDOM, step: TourStep, _parts: StepParts): void {
    popover.wrapper.classList.add(DIALOG_CLASS);
    popover.wrapper.setAttribute(this.stepAttr, String(this.tour.steps.indexOf(step)));
  }

  afterShow(_popover: PopoverDOM, _step: TourStep): void {}

  afterReposition(_popover: PopoverDOM, _step: TourStep, _info: RepositionInfo): void {}

  update(_popover: PopoverDOM, _step: TourStep, _parts: StepParts): void {}

  beforeLeave(_step: TourStep): void {}

  unmount(): void {}
}
