import type { Tour } from "../index";

const INDEX_VAR = "--vt-progress-index";
const TOTAL_VAR = "--vt-progress-total";

/**
 * Sets `--vt-progress-index` and `--vt-progress-total` on the popover whenever a step is shown, when the step list
 * changes under a step on screen, and now when a step is already on screen, so CSS can draw progress. Returns a
 * function that stops updating and removes both variables.
 */
export function progressVars(tour: Tour): () => void {
  let applied: HTMLElement | null = null;

  const apply = (element: HTMLElement | null | undefined): void => {
    if (!element) return;
    const { index, total } = tour.progressInfo();
    element.style.setProperty(INDEX_VAR, String(index));
    element.style.setProperty(TOTAL_VAR, String(total));
    applied = element;
  };

  const sync = (): void => {
    const current = tour.currentStep;
    if (current?.isShown()) apply(current.element);
  };

  const stops = [tour.on("step-shown", ({ step }) => apply(step.element)), tour.on("steps-changed", sync)];
  sync();

  return () => {
    for (const stop of stops) stop();
    applied?.style.removeProperty(INDEX_VAR);
    applied?.style.removeProperty(TOTAL_VAR);
    applied = null;
  };
}
