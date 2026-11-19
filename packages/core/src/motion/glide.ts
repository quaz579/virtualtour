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
const FADE_ATTR = "data-vt-fade";
const DUMMY_ID = "vt-dummy-element";

function isCentered(step: TourStep): boolean {
  const target = step.resolvedTarget;
  return target === null || target.id === DUMMY_ID;
}

/**
 * Slides the popover from where the previous step left it to where the next step puts it, instead of fading the new
 * popover in: the engine's entrance animations on the new popover are finished at once. Does nothing under reduced motion, when the tour's `animate` is off, when one step is centered and the
 * other is not, or when the two steps use different popover layouts. Returns a function that stops listening and
 * cancels a glide in progress.
 */
export function glide(tour: Tour, options: GlideOptions = {}): () => void {
  const durationMs = options.durationMs ?? 250;
  const easing = options.easing ?? "cubic-bezier(.2,.8,.2,1)";
  let departure: Departure | null = null;
  let running: { animation: Animation } | null = null;
  let stopHide: (() => void) | null = null;

  const settle = (): void => {
    if (!running) return;
    const { animation } = running;
    running = null;
    animation.cancel();
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
    });
  };

  const stopShown = tour.on("step-shown", ({ step, previous }) => {
    settle();
    const from = departure;
    departure = null;
    watch(step);
    const element = step.element;
    if (!from || !previous || from.step !== previous || !element) return;
    if (typeof element.animate !== "function") return;
    if (prefersReducedMotion() || !document.body.hasAttribute(FADE_ATTR)) return;
    if (from.centered !== isCentered(step) || from.dialog !== element.classList.contains(DIALOG_CLASS)) return;
    for (const entering of element.getAnimations?.() ?? []) {
      try {
        entering.finish();
      } catch {
        continue;
      }
    }
    const rect = element.getBoundingClientRect();
    const dx = from.left - rect.left;
    const dy = from.top - rect.top;
    if (dx === 0 && dy === 0) return;
    element.classList.add(GLIDE_CLASS);
    const animation = element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
      { duration: durationMs, easing },
    );
    running = { animation };
    animation.addEventListener("finish", () => {
      if (running?.animation === animation) running = null;
    });
  });

  const current = tour.currentStep;
  if (current?.isShown()) watch(current);

  const stopEnd = [tour.on("finished", () => (departure = null)), tour.on("exited", () => (departure = null))];

  return () => {
    stopShown();
    for (const stop of stopEnd) stop();
    stopHide?.();
    stopHide = null;
    departure = null;
    settle();
  };
}
