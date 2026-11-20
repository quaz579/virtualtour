import { prefersReducedMotion } from "../engine/core/env";
import type { Tour, TourStep } from "../index";

/** Options for {@link glide}. */
export interface GlideOptions {
  /** How long the popover takes to travel between steps. Default 250. */
  durationMs?: number;
  /** CSS easing for the travel. Default `cubic-bezier(.2,.8,.2,1)`. */
  easing?: string;
}

interface Departure {
  step: TourStep;
  left: number;
  top: number;
  centered: boolean;
  dialog: boolean;
}

const GLIDE_CLASS = "vt-glide";
const DIALOG_CLASS = "vt-dialog";
const POPOVER_CLASS = "vt-popover";
const STEP_ATTR = "data-vt-step";
const FADE_ATTR = "data-vt-fade";
const DUMMY_ID = "vt-dummy-element";

function isCentered(step: TourStep): boolean {
  const target = step.resolvedTarget;
  return target === null || target.id === DUMMY_ID;
}

/**
 * Slides the popover from where the previous step left it to where the next step puts it, instead of fading the new
 * popover in: the engine's entrance animations on the new popover are finished at once. Does nothing under reduced
 * motion, when the tour's `animate` is off, when one step is centered and the other is not, or when the two steps use
 * different popover layouts. Returns a function that stops listening and cancels a glide in progress.
 */
export function glide(tour: Tour, options: GlideOptions = {}): () => void {
  const durationMs = options.durationMs ?? 250;
  const easing = options.easing ?? "cubic-bezier(.2,.8,.2,1)";
  let departure: Departure | null = null;
  let running: { animation: Animation; element: Element } | null = null;
  let stopHide: (() => void) | null = null;
  let observer: MutationObserver | null = null;

  const settle = (): void => {
    if (!running) return;
    const { animation } = running;
    running = null;
    animation.cancel();
  };

  const disarm = (): void => {
    observer?.disconnect();
    observer = null;
  };

  const begin = (step: TourStep, element: HTMLElement): void => {
    const from = departure;
    departure = null;
    disarm();
    if (!from || from.step === step || running?.element === element) return;
    settle();
    if (typeof element.animate !== "function") return;
    if (prefersReducedMotion() || !document.body.hasAttribute(FADE_ATTR)) return;
    if (from.centered !== isCentered(step) || from.dialog !== element.classList.contains(DIALOG_CLASS)) return;
    const finished: { animation: Animation; at: CSSNumberish | null }[] = [];
    for (const entering of element.getAnimations?.() ?? []) {
      const at = entering.currentTime;
      try {
        entering.finish();
        finished.push({ animation: entering, at });
      } catch {
        continue;
      }
    }
    const rect = element.getBoundingClientRect();
    const dx = from.left - rect.left;
    const dy = from.top - rect.top;
    if (dx === 0 && dy === 0) {
      for (const { animation, at } of finished) animation.currentTime = at;
      return;
    }
    element.classList.add(GLIDE_CLASS);
    const animation = element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
      { duration: durationMs, easing },
    );
    running = { animation, element };
    animation.addEventListener("finish", () => {
      if (running?.animation === animation) running = null;
    });
  };

  const arm = (): void => {
    disarm();
    if (typeof MutationObserver !== "function") return;
    observer = new MutationObserver((records) => {
      for (const { addedNodes } of records) {
        for (const node of addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const element = node.classList.contains(POPOVER_CLASS) ? node : node.querySelector<HTMLElement>(`.${POPOVER_CLASS}`);
          const step = element && tour.steps[Number(element.getAttribute(STEP_ATTR))];
          if (element && step) return begin(step, element);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const watch = (step: TourStep): void => {
    stopHide?.();
    stopHide = step.once("will-hide", () => {
      stopHide = null;
      const element = step.element;
      if (!element?.isConnected) {
        departure = null;
        return;
      }
      const rect = element.getBoundingClientRect();
      departure = {
        step,
        left: rect.left,
        top: rect.top,
        centered: isCentered(step),
        dialog: element.classList.contains(DIALOG_CLASS),
      };
      arm();
    });
  };

  const stopShown = tour.on("step-shown", ({ step }) => {
    const element = step.element;
    if (running && running.element !== element) settle();
    if (element && departure) begin(step, element);
    departure = null;
    disarm();
    watch(step);
  });

  const current = tour.currentStep;
  if (current?.isShown()) watch(current);

  const forget = (): void => {
    departure = null;
    disarm();
  };
  const stopEnd = [tour.on("finished", forget), tour.on("exited", forget)];

  return () => {
    stopShown();
    for (const stop of stopEnd) stop();
    stopHide?.();
    stopHide = null;
    forget();
    settle();
  };
}
