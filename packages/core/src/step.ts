import { Emitter } from "./events";
import type { StepEvents } from "./events";
import { patchStepConfig } from "./config";
import { resolveTarget } from "./dom/target";
import type { StepConfig, StepConfigPatch, TourStepLike } from "./types";
import type { Tour } from "./tour";

interface StepState {
  config: StepConfig;
  defaults: StepConfig;
  element: HTMLElement | undefined | null;
  resolvedTarget: Element | null;
  resolved: boolean;
  shown: boolean;
  disposed: boolean;
  emitter: Emitter<StepEvents>;
}

const states = new WeakMap<object, StepState>();

let onConfigured: (step: TourStep) => void = () => {};

/** Registers the function that re-renders a shown step after `configure`. Internal. */
export function setConfiguredHook(hook: (step: TourStep) => void): void {
  onConfigured = hook;
}

export function setStepDefaults(step: TourStep, defaults: StepConfig): void {
  stateOf(step).defaults = defaults;
}

function stateOf(step: TourStep): StepState {
  return states.get(step) as StepState;
}

/** One step of a tour. Created by the tour; never constructed by callers. */
export class TourStep {
  readonly id: string;
  readonly tour: Tour;

  constructor(tour: Tour, id: string, config: StepConfig) {
    this.tour = tour;
    this.id = id;
    states.set(this, {
      config,
      defaults: {},
      element: undefined,
      resolvedTarget: null,
      resolved: false,
      shown: false,
      disposed: false,
      emitter: new Emitter<StepEvents>(),
    });
  }

  /** The step's configuration with the tour's step defaults applied; {@link TourStep.configure} replaces it. */
  get config(): Readonly<StepConfig> {
    return stateOf(this).config;
  }

  /** The popover wrapper of the most recent show: `undefined` before the first show, `null` after dispose. */
  get element(): HTMLElement | undefined | null {
    return stateOf(this).element;
  }

  /** The element the step points at, once the tour has resolved it. */
  get resolvedTarget(): Element | null {
    return stateOf(this).resolvedTarget;
  }

  /**
   * Merges `patch` into the step's configuration the way the tour merges `stepDefaults`: nested groups merge key
   * by key, arrays such as `buttons` are replaced, and `undefined` values and `id` are ignored. A `null` clears the
   * field back to the tour's default for it, or removes it when there is none. While the step is on
   * screen its title, body, label, buttons, classes, close button and counter update in place, with the same popover element and
   * no events; every other field, `target` and `position` included, takes effect the next time the step shows.
   */
  configure(patch: StepConfigPatch): void {
    const state = stateOf(this);
    const merged = patchStepConfig(state.config, patch, state.defaults);
    merged.id = this.id;
    state.config = merged;
    if (state.shown) onConfigured(this);
  }

  /** Moves the tour to this step. */
  show(): Promise<void> {
    return this.tour.goTo(this);
  }

  /** Hides the popover when this step is the current one; the tour stays running. */
  hide(): void {
    if (this.tour.currentStep === this) this.tour.hideCurrent();
  }

  /** Ends the tour as {@link Tour.exit} does. */
  exit(): Promise<boolean> {
    return this.tour.exit();
  }

  /** Completes the tour as {@link Tour.finish} does. */
  finish(): void {
    this.tour.finish();
  }

  /** Releases the step's element and target and emits `disposed` once. */
  dispose(): void {
    const state = stateOf(this);
    if (state.disposed) return;
    state.disposed = true;
    state.shown = false;
    state.element = null;
    state.resolvedTarget = null;
    state.resolved = false;
    state.emitter.emit("disposed", { step: this });
  }

  /** Whether the step's popover is on screen. */
  isShown(): boolean {
    return stateOf(this).shown;
  }

  on<E extends keyof StepEvents>(e: E, fn: (payload: StepEvents[E]) => void, ctx?: object): () => void {
    return stateOf(this).emitter.on(e, fn, ctx);
  }

  once<E extends keyof StepEvents>(e: E, fn: (payload: StepEvents[E]) => void, ctx?: object): () => void {
    return stateOf(this).emitter.once(e, fn, ctx);
  }

  off<E extends keyof StepEvents>(e?: E, fn?: (payload: StepEvents[E]) => void): void {
    stateOf(this).emitter.off(e, fn);
  }
}

/** Emits a step event. Internal. */
export function emitStep<E extends keyof StepEvents>(step: TourStep, e: E, payload: StepEvents[E]): void {
  stateOf(step).emitter.emit(e, payload);
}

/** Records the target the navigator found for the step about to show; `null` means centered. Internal. */
export function setResolvedTarget(step: TourStep, target: Element | null): void {
  const state = stateOf(step);
  state.resolvedTarget = target;
  state.resolved = true;
}

/** The element the engine should use for the step: the navigator's result once resolved, a live lookup before. Internal. */
export function lookupTarget(step: TourStepLike): Element | null {
  const state = states.get(step);
  if (state?.resolved) return state.resolvedTarget;
  const live = resolveTarget(step.config.target);
  return state ? live : (live ?? step.resolvedTarget);
}

/** Records that the step's popover is on screen. Internal. */
export function markShown(step: TourStep, element: HTMLElement, target: Element | null): void {
  const state = stateOf(step);
  state.element = element;
  state.resolvedTarget = target;
  state.resolved = target === null;
  state.shown = true;
  state.disposed = false;
}

/** Records that the step's popover left the screen; the element stays readable until the next show. Internal. */
export function markHidden(step: TourStep): void {
  const state = stateOf(step);
  state.shown = false;
  state.resolved = false;
}

/** Returns the step to its never-shown state at the start of a run. Internal. */
export function resetStep(step: TourStep): void {
  const state = stateOf(step);
  state.element = undefined;
  state.resolvedTarget = null;
  state.resolved = false;
  state.shown = false;
  state.disposed = false;
}

/** Detaches a step that was removed while no run was active: no event, no further use. Internal. */
export function retireStep(step: TourStep): void {
  const state = stateOf(step);
  state.element = null;
  state.resolvedTarget = null;
  state.resolved = false;
  state.shown = false;
  state.disposed = true;
  state.emitter.off();
}
