import { normalizeTourConfig, resolveStepConfig } from "./config";
import type { NormalizedTourConfig } from "./config";
import { TourEnvironmentError, TourNavigationError } from "./errors";
import { Emitter } from "./events";
import type { TourEvents } from "./events";
import { NavigationQueue } from "./navigator";
import { DialogPresenter } from "./presenter";
import { relayTourEvent } from "./registry";
import { retireStep, TourStep } from "./step";
import type { Presenter, StepConfig, TourConfig } from "./types";

interface TourInternals {
  normalized: NormalizedTourConfig;
  emitter: Emitter<TourEvents>;
  queue: NavigationQueue;
  steps: TourStep[];
  currentIndex: number;
  nextStepNumber: number;
  presenter: Presenter | null;
}

const internals = new WeakMap<object, TourInternals>();

function internalsOf(tour: Tour): TourInternals {
  return internals.get(tour) as TourInternals;
}

function notWired(method: string): Promise<never> {
  return Promise.reject(new TourNavigationError(`[virtualtour] Tour.${method}() is not available yet.`));
}

/** A guided tour: an ordered list of steps plus the events and queries around them. */
export class Tour {
  readonly id: string;
  declare readonly name?: string;

  constructor(config: TourConfig = {}) {
    const normalized = normalizeTourConfig(config);
    this.id = normalized.id;
    if (normalized.name !== undefined) this.name = normalized.name;
    const state: TourInternals = {
      normalized,
      emitter: new Emitter<TourEvents>(),
      queue: new NavigationQueue(),
      steps: [],
      currentIndex: -1,
      nextStepNumber: 1,
      presenter: null,
    };
    internals.set(this, state);
    const reserved = new Set<string>();
    for (const def of normalized.steps) if (def.id !== undefined) reserved.add(def.id);
    for (const def of normalized.steps) state.steps.push(this.createStep(def, reserved));
  }

  /** The steps in order. Created eagerly, so no DOM is needed. */
  get steps(): readonly TourStep[] {
    return internalsOf(this).steps;
  }

  /** The step on screen, or `null`. */
  get currentStep(): TourStep | null {
    const state = internalsOf(this);
    return state.steps[state.currentIndex] ?? null;
  }

  /** Whether a run is active. */
  isRunning(): boolean {
    return false;
  }

  /** Finds a step by id. */
  stepById(id: string): TourStep | undefined {
    return internalsOf(this).steps.find((s) => s.id === id);
  }

  /**
   * Adds a step at the end, at a zero-based index, or before the step with the given id. Throws
   * {@link TourNavigationError} for an out-of-range index, an unknown id, or an id already in use.
   */
  appendStep(def: StepConfig, at?: number | string): TourStep {
    const state = internalsOf(this);
    let index = state.steps.length;
    if (typeof at === "number") {
      if (!Number.isInteger(at) || at < 0 || at > state.steps.length) {
        throw new TourNavigationError(`[virtualtour] Cannot insert a step at index ${at}: the tour has ${state.steps.length} steps.`);
      }
      index = at;
    } else if (typeof at === "string") {
      index = state.steps.findIndex((s) => s.id === at);
      if (index < 0) throw new TourNavigationError(`[virtualtour] Cannot insert before "${at}": no such step.`);
    }
    const step = this.createStep(def);
    state.steps.splice(index, 0, step);
    if (index <= state.currentIndex) state.currentIndex += 1;
    return step;
  }

  /** Removes a step by id or instance; an unknown reference does nothing. */
  dropStep(ref: string | TourStep): void {
    const state = internalsOf(this);
    const index = typeof ref === "string" ? state.steps.findIndex((s) => s.id === ref) : state.steps.indexOf(ref);
    const step = state.steps[index];
    if (!step) return;
    state.steps.splice(index, 1);
    if (index < state.currentIndex) state.currentIndex -= 1;
    else if (index === state.currentIndex) state.currentIndex = -1;
    retireStep(step);
  }

  /** Repositions the popover. Does nothing while no run is active. */
  refresh(): void {}

  /** Starts the tour. */
  async start(): Promise<void> {
    if (typeof document === "undefined") {
      throw new TourEnvironmentError("[virtualtour] Tour.start() needs a browser document.");
    }
    return notWired("start");
  }

  forward(): Promise<void> {
    return notWired("forward");
  }

  backward(): Promise<void> {
    return notWired("backward");
  }

  goTo(_ref?: string | number | TourStep): Promise<void> {
    return notWired("goTo");
  }

  exit(): Promise<boolean> {
    return notWired("exit");
  }

  finish(): void {
    throw new TourNavigationError("[virtualtour] Tour.finish() is not available yet.");
  }

  hideCurrent(): void {
    throw new TourNavigationError("[virtualtour] Tour.hideCurrent() is not available yet.");
  }

  on<E extends keyof TourEvents>(e: E, fn: (payload: TourEvents[E]) => void, ctx?: object): () => void {
    return internalsOf(this).emitter.on(e, fn, ctx);
  }

  once<E extends keyof TourEvents>(e: E, fn: (payload: TourEvents[E]) => void, ctx?: object): () => void {
    return internalsOf(this).emitter.once(e, fn, ctx);
  }

  off<E extends keyof TourEvents>(e?: E, fn?: (payload: TourEvents[E]) => void): void {
    internalsOf(this).emitter.off(e, fn);
  }

  private createStep(def: StepConfig, reserved?: ReadonlySet<string>): TourStep {
    const state = internalsOf(this);
    const taken = (id: string): boolean => state.steps.some((s) => s.id === id);
    const unavailable = (id: string): boolean => taken(id) || (reserved?.has(id) ?? false);
    let id = def.id;
    if (id === undefined) {
      do id = `step-${state.nextStepNumber++}`;
      while (unavailable(id));
    } else if (taken(id)) {
      throw new TourNavigationError(`[virtualtour] Duplicate step id "${id}" in tour "${this.id}".`);
    }
    const config = resolveStepConfig(state.normalized, def);
    config.id = id;
    return new TourStep(this, id, config);
  }
}

/** Emits a tour event to the tour's listeners, then to the registry's. Internal. */
export function emitTour<E extends keyof TourEvents>(tour: Tour, e: E, payload: TourEvents[E]): void {
  internalsOf(tour).emitter.emit(e, payload);
  relayTourEvent(e, payload);
}

/** The navigation queue of a tour. Internal. */
export function navigationQueue(tour: Tour): NavigationQueue {
  return internalsOf(tour).queue;
}

/** Sets the index of the step on screen, `-1` for none. Internal. */
export function setCurrentIndex(tour: Tour, index: number): void {
  internalsOf(tour).currentIndex = index;
}

/** The tour's presenter, built on first use from `config.presenter` or the default dialog presenter. Internal. */
export function presenterOf(tour: Tour): Presenter {
  const state = internalsOf(tour);
  state.presenter ??= state.normalized.presenter
    ? state.normalized.presenter(tour)
    : new DialogPresenter(tour, state.normalized.namespace);
  return state.presenter;
}

/** Unmounts and forgets the tour's presenter at the end of a run. Internal. */
export function releasePresenter(tour: Tour): void {
  const state = internalsOf(tour);
  state.presenter?.unmount();
  state.presenter = null;
}

/** The normalized configuration of a tour. Internal. */
export function normalizedConfigOf(tour: Tour): NormalizedTourConfig {
  return internalsOf(tour).normalized;
}

/** Creates a tour. Safe to call on the server; `start()` needs a browser. */
export function createTour(config: TourConfig = {}): Tour {
  return new Tour(config);
}
