import { compileStepForShow, compileTour } from "./compile";
import type { EngineStep } from "./compile";
import { normalizeTourConfig, resolveStepConfig } from "./config";
import type { NormalizedTourConfig } from "./config";
import { createEngine } from "./engine/driver";
import type { Config, DriveStep, Driver, EnginePresenter, RepositionInfo as EngineRepositionInfo } from "./engine/driver";
import type { PopoverDOM } from "./engine/popover/popover";
import { TourEnvironmentError, TourNavigationError } from "./errors";
import { Emitter } from "./events";
import type { ExitReason, TourEvents } from "./events";
import { NavigationQueue, resolveStepIndex, selectIndex } from "./navigator";
import { DialogPresenter } from "./presenter";
import { relayTourEvent, setCurrentTour, tours } from "./registry";
import { emitStep, markHidden, markShown, resetStep, retireStep, TourStep } from "./step";
import type { Presenter, RepositionInfo, StepConfig, TourConfig } from "./types";

type EndKind = "finished" | ExitReason;

interface TourInternals {
  normalized: NormalizedTourConfig;
  emitter: Emitter<TourEvents>;
  queue: NavigationQueue;
  steps: TourStep[];
  currentIndex: number;
  anchorIndex: number;
  nextStepNumber: number;
  presenter: Presenter | null;
  engine: Driver | null;
  running: boolean;
  ending: boolean;
  hiding: boolean;
  endKind: EndKind | null;
  runId: number;
  abort: AbortController | null;
  waiter: (() => void) | null;
  pendingExit: Promise<boolean> | null;
  previousStep: TourStep | null;
  mounted: { popover: PopoverDOM; step: TourStep } | null;
}

const internals = new WeakMap<object, TourInternals>();

function internalsOf(tour: Tour): TourInternals {
  return internals.get(tour) as TourInternals;
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
      anchorIndex: -1,
      nextStepNumber: 1,
      presenter: null,
      engine: null,
      running: false,
      ending: false,
      hiding: false,
      endKind: null,
      runId: 0,
      abort: null,
      waiter: null,
      pendingExit: null,
      previousStep: null,
      mounted: null,
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

  /** Whether a run is active. Stays true while the popover is hidden with {@link Tour.hideCurrent}. */
  isRunning(): boolean {
    return internalsOf(this).running;
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
    if (index <= state.anchorIndex) state.anchorIndex += 1;
    if (state.running) syncEngineSteps(this);
    return step;
  }

  /**
   * Removes a step by id or instance; an unknown reference does nothing. While a run is active the step is disposed
   * at once; if it was on screen the tour moves to the step that now follows it, or exits without a prompt when none does.
   */
  dropStep(ref: string | TourStep): void {
    const state = internalsOf(this);
    const index = typeof ref === "string" ? state.steps.findIndex((s) => s.id === ref) : state.steps.indexOf(ref);
    const step = state.steps[index];
    if (!step) return;
    if (!state.running) {
      state.steps.splice(index, 1);
      if (index < state.currentIndex) state.currentIndex -= 1;
      else if (index === state.currentIndex) state.currentIndex = -1;
      retireStep(step);
      return;
    }
    const wasVisible = state.steps[state.currentIndex] === step;
    const wasTarget = state.anchorIndex === index && !wasVisible && state.waiter !== null;
    leaveStep(this, step);
    state.steps.splice(index, 1);
    if (index < state.currentIndex) state.currentIndex -= 1;
    if (index < state.anchorIndex) state.anchorIndex -= 1;
    else if (index === state.anchorIndex) state.anchorIndex = index - 1;
    step.dispose();
    retireStep(step);
    if (state.engine) syncEngineSteps(this);
    if (wasTarget) settle(state);
    if (!wasVisible && !wasTarget) return;
    const outcome = selectIndex(state.steps.length, index - 1, "forward");
    if (outcome.kind === "show") {
      const target = outcome.index;
      reportFailure(state.queue.enqueue(() => showStep(this, target)));
      return;
    }
    state.anchorIndex = -1;
    terminate(this, "api");
  }

  /** Repositions the popover. Does nothing while no run is active. */
  refresh(): void {
    internalsOf(this).engine?.refresh();
  }

  /**
   * Starts the tour at its first step. Does nothing when a run is already active, and any other running tour ends
   * with `exited` (reason `replaced`). The run counts as active until just before `deactivated`, so a restart
   * belongs in a `deactivated` handler. Resolves once the first step is shown, or at once when a run is already active; rejects with
   * {@link TourEnvironmentError} when there is no browser document.
   */
  async start(): Promise<void> {
    requireDocument("start");
    if (!beginRun(this)) return;
    await navigateGuarded(this, () => runNavigation(this, "forward"));
  }

  /** Moves to the next step, or finishes after the last one. Does nothing while no run is active. */
  forward(): Promise<void> {
    return navigate(this, "forward");
  }

  /** Moves to the previous step. Does nothing on the first step or while no run is active; exits when no earlier step is eligible. */
  backward(): Promise<void> {
    return navigate(this, "backward");
  }

  /**
   * Shows a step by index, id or instance. Without an argument it shows the current step again (after
   * {@link Tour.hideCurrent}) or the first step. Starts the tour when none is running. Rejects with
   * {@link TourNavigationError} for a reference that matches no step.
   */
  async goTo(ref?: string | number | TourStep): Promise<void> {
    const state = internalsOf(this);
    if (ref !== undefined) resolveStepIndex(state.steps, ref);
    else if (state.steps.length === 0) throw new TourNavigationError("[virtualtour] Cannot go to a step: the tour has no steps.");
    if (!state.running) {
      requireDocument("goTo");
      beginRun(this);
    }
    await navigateGuarded(this, async () => {
      const index = ref === undefined ? Math.max(state.anchorIndex, 0) : resolveStepIndex(state.steps, ref);
      await showStep(this, index);
    });
  }

  /**
   * Ends the run as cancelled, after the exit prompt when one is configured. Resolves `false` when the prompt
   * declined and `true` otherwise, including when no run is active.
   */
  exit(): Promise<boolean> {
    return requestExit(this, "api");
  }

  /** Ends the run as completed. Does nothing while no run is active. */
  finish(): void {
    terminate(this, "finished");
  }

  /** Removes the popover while the run stays active; the next navigation shows a step again. */
  hideCurrent(): void {
    const state = internalsOf(this);
    const engine = state.engine;
    if (!state.running || state.ending || state.hiding || !engine) return;
    state.hiding = true;
    try {
      if (engine.isActive()) engine.destroy();
    } finally {
      state.hiding = false;
    }
    state.engine = null;
    state.mounted = null;
    for (const step of state.steps) leaveStep(this, step);
    settle(state);
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

function requireDocument(method: string): void {
  if (typeof document === "undefined") {
    throw new TourEnvironmentError(`[virtualtour] Tour.${method}() needs a browser document.`);
  }
}

function reportFailure(promise: Promise<unknown>): void {
  promise.catch((error: unknown) => console.error("[virtualtour] Navigation failed:", error));
}

function guarded(label: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    console.error(`[virtualtour] ${label} threw:`, error);
  }
}

function settle(state: TourInternals): void {
  const waiter = state.waiter;
  state.waiter = null;
  waiter?.();
}

function stepOf(tour: Tour, driveStep: DriveStep | undefined): TourStep | undefined {
  const step = driveStep?.data?.["vt"] as TourStep | undefined;
  return step && internalsOf(tour).steps.includes(step) ? step : undefined;
}

function leaveStep(tour: Tour, step: TourStep): void {
  const state = internalsOf(tour);
  if (!step.isShown()) return;
  guarded("presenter.beforeLeave", () => state.presenter?.beforeLeave(step));
  emitStep(step, "will-hide", { step });
  markHidden(step);
  if (state.steps[state.currentIndex] === step) state.currentIndex = -1;
  state.previousStep = step;
  emitStep(step, "hidden", { step });
}

function bubbleRectOf(wrapper: HTMLElement): DOMRect | undefined {
  return wrapper.querySelector<HTMLElement>(".vt-bubble")?.getBoundingClientRect();
}

function enginePresenterFor(tour: Tour, presenter: Presenter): EnginePresenter {
  const state = internalsOf(tour);
  const adapter: EnginePresenter = {
    mount(popover, driveStep) {
      const step = stepOf(tour, driveStep);
      if (!step) return;
      state.mounted = { popover, step };
      guarded("presenter.mount", () => presenter.mount(popover, step, { buttons: [] }));
    },
    afterReposition(info: EngineRepositionInfo) {
      const mounted = state.mounted;
      if (!mounted) return;
      const full: RepositionInfo = {
        side: info.side,
        align: info.align,
        wrapperRect: info.wrapperRect,
        bubbleRect: bubbleRectOf(mounted.popover.wrapper) ?? info.wrapperRect,
        targetRect: info.targetRect,
      };
      guarded("presenter.afterReposition", () => presenter.afterReposition(mounted.popover, mounted.step, full));
    },
  };
  if (presenter.layout !== undefined) adapter.layout = presenter.layout;
  return adapter;
}

function evaluatedStep(tour: Tour, index: number): EngineStep {
  const state = internalsOf(tour);
  const step = state.steps[index] as TourStep;
  const out = compileStepForShow(step, state.normalized.dimOptions.radius);
  const counter = state.normalized.counter;
  if (typeof counter === "function") {
    out.popover = { ...out.popover, progressText: counter(index + 1, state.steps.length) };
  }
  return out;
}

function syncEngineSteps(tour: Tour): void {
  const state = internalsOf(tour);
  const engine = state.engine;
  if (!engine) return;
  const shown = state.steps[state.currentIndex];
  const previous = (engine.getConfig().steps ?? []).find((s) => s.data?.["vt"] === shown);
  const steps = compileTour(state.normalized, state.steps).steps as DriveStep[];
  if (shown && previous) steps[state.currentIndex] = previous;
  engine.setConfig({ ...engine.getConfig(), steps });
}

function evaluateStepInto(tour: Tour, index: number): void {
  const engine = internalsOf(tour).engine;
  if (!engine) return;
  const steps = (engine.getConfig().steps ?? []).slice();
  steps[index] = evaluatedStep(tour, index) as DriveStep;
  engine.setConfig({ ...engine.getConfig(), steps });
}

function ensureEngine(tour: Tour): Driver {
  const state = internalsOf(tour);
  if (state.engine) return state.engine;
  const presenter = presenterOf(tour);
  const compiled = compileTour(state.normalized, state.steps);
  let self: Driver | null = null;
  const owns = (): boolean => self !== null && state.engine === self;
  const config = {
    ...compiled.base,
    steps: compiled.steps,
    presenter: enginePresenterFor(tour, presenter),
    onHighlightStarted(_element: Element | undefined, driveStep: DriveStep) {
      if (!owns()) return;
      const step = stepOf(tour, driveStep);
      if (!step) return;
      state.anchorIndex = state.steps.indexOf(step);
      emitStep(step, "will-show", { step });
    },
    onHighlighted(element: Element | undefined, driveStep: DriveStep) {
      if (!owns()) return;
      const step = stepOf(tour, driveStep);
      const popover = state.engine?.getState("popover") as PopoverDOM | undefined;
      if (!step || !popover) {
        settle(state);
        return;
      }
      markShown(step, popover.wrapper, element ?? null);
      const index = state.steps.indexOf(step);
      state.currentIndex = index;
      state.anchorIndex = index;
      guarded("presenter.afterShow", () => presenter.afterShow(popover, step));
      emitStep(step, "shown", { step });
      emitTour(tour, "step-shown", { tour, step, previous: state.previousStep });
      settle(state);
    },
    onDeselected(_element: Element | undefined, driveStep: DriveStep) {
      if (!owns()) return;
      const step = stepOf(tour, driveStep);
      if (step) leaveStep(tour, step);
    },
    onNextClick() {
      if (owns()) reportFailure(tour.forward());
    },
    onDoneClick() {
      if (owns()) reportFailure(tour.forward());
    },
    onPrevClick() {
      if (owns()) reportFailure(tour.backward());
    },
    onDestroyStarted(_element: Element | undefined, _driveStep: DriveStep, opts: { reason?: string | undefined }) {
      if (!owns()) return;
      const reason = opts.reason;
      if (reason === "done") terminate(tour, "finished");
      else if (reason === "close" || reason === "escape" || reason === "overlay") reportFailure(requestExit(tour, reason));
      else terminate(tour, reason === "replaced" ? "replaced" : "api");
    },
    onDestroyed(_element: Element | undefined, driveStep: DriveStep, opts: { reason?: string | undefined }) {
      if (!owns() || state.hiding) return;
      const reason = opts.reason;
      const kind: EndKind = state.endKind ?? (reason === "done" ? "finished" : ((reason ?? "api") as ExitReason));
      endRun(tour, kind, stepOf(tour, driveStep));
    },
  } as Config;
  self = createEngine(config);
  state.engine = self;
  return self;
}

async function showStep(tour: Tour, index: number): Promise<void> {
  const state = internalsOf(tour);
  const step = state.steps[index];
  if (!state.running || state.ending || !step) return;
  if (step.isShown() && state.engine?.isActive()) return;
  const engine = ensureEngine(tour);
  evaluateStepInto(tour, index);
  settle(state);
  const shown = new Promise<void>((resolve) => {
    state.waiter = resolve;
  });
  engine.moveTo(index);
  await shown;
}

async function runNavigation(tour: Tour, direction: "forward" | "backward"): Promise<void> {
  const state = internalsOf(tour);
  if (!state.running || state.ending) return;
  const outcome = selectIndex(state.steps.length, state.anchorIndex, direction);
  if (outcome.kind === "show") await showStep(tour, outcome.index);
  else if (outcome.kind === "finish") terminate(tour, "finished");
  else if (outcome.kind === "exit") terminate(tour, "api");
}

function navigate(tour: Tour, direction: "forward" | "backward"): Promise<void> {
  const state = internalsOf(tour);
  if (!state.running) return Promise.resolve();
  return navigateGuarded(tour, () => runNavigation(tour, direction));
}

async function navigateGuarded(tour: Tour, task: () => Promise<void>): Promise<void> {
  const runId = internalsOf(tour).runId;
  try {
    await internalsOf(tour).queue.enqueue(task);
  } catch (error) {
    if (!(error instanceof TourNavigationError) && internalsOf(tour).runId === runId) terminate(tour, "api");
    throw error;
  }
}

function beginRun(tour: Tour): boolean {
  const state = internalsOf(tour);
  if (state.running) return false;
  const other = tours.current;
  if (other && other !== tour) terminate(other, "replaced");
  state.running = true;
  state.runId += 1;
  state.abort = new AbortController();
  state.currentIndex = -1;
  state.anchorIndex = -1;
  state.previousStep = null;
  for (const step of state.steps) resetStep(step);
  setCurrentTour(tour);
  emitTour(tour, "started", { tour });
  emitTour(tour, "activated", { tour });
  return true;
}

function endRun(tour: Tour, kind: EndKind, hookStep?: TourStep): void {
  const state = internalsOf(tour);
  if (!state.running || state.ending) return;
  state.ending = true;
  const endStep = hookStep ?? state.steps[state.currentIndex] ?? state.steps[state.anchorIndex];
  for (const step of state.steps) leaveStep(tour, step);
  if (kind === "finished") {
    if (endStep) emitStep(endStep, "finished", { step: endStep });
    emitTour(tour, "finished", { tour });
  } else {
    if (endStep) emitStep(endStep, "exited", { step: endStep });
    emitTour(tour, "exited", { tour, reason: kind });
  }
  for (const step of state.steps.slice()) step.dispose();
  guarded("presenter.unmount", () => releasePresenter(tour));
  state.abort?.abort();
  state.abort = null;
  state.queue.cancelWaiting();
  settle(state);
  state.engine = null;
  state.mounted = null;
  state.pendingExit = null;
  state.endKind = null;
  state.hiding = false;
  state.currentIndex = -1;
  state.anchorIndex = -1;
  state.previousStep = null;
  if (tours.current === tour) setCurrentTour(null);
  state.running = false;
  state.ending = false;
  emitTour(tour, "deactivated", { tour });
}

function terminate(tour: Tour, kind: EndKind): void {
  const state = internalsOf(tour);
  if (!state.running || state.ending) return;
  state.endKind = kind;
  const runId = state.runId;
  const engine = state.engine;
  if (engine?.isActive()) engine.destroy();
  if (state.runId === runId) endRun(tour, kind);
}

async function askExit(tour: Tour): Promise<boolean> {
  const prompt = internalsOf(tour).normalized.exitPrompt;
  if (prompt === false) return true;
  if (typeof prompt === "string") return window.confirm(prompt);
  try {
    return Boolean(await prompt());
  } catch (error) {
    console.error("[virtualtour] exitPrompt threw; the tour stays open:", error);
    return false;
  }
}

function requestExit(tour: Tour, reason: ExitReason): Promise<boolean> {
  const state = internalsOf(tour);
  if (!state.running || state.ending) return Promise.resolve(true);
  if (state.pendingExit) return state.pendingExit;
  const prompt = state.normalized.exitPrompt;
  if (prompt === false || typeof prompt === "string") {
    const accepted = prompt === false || window.confirm(prompt);
    if (accepted) terminate(tour, reason);
    return Promise.resolve(accepted);
  }
  const runId = state.runId;
  const pending: Promise<boolean> = askExit(tour).then((accepted) => {
    if (state.pendingExit === pending) state.pendingExit = null;
    if (accepted && state.running && state.runId === runId) terminate(tour, reason);
    return accepted;
  });
  state.pendingExit = pending;
  return pending;
}

/** The engine of the current run, or `null` while none exists. Internal. */
export function engineOf(tour: Tour): Driver | null {
  return internalsOf(tour).engine;
}

/** The abort signal of the current run; it aborts when the run ends. Internal. */
export function runSignal(tour: Tour): AbortSignal | null {
  return internalsOf(tour).abort?.signal ?? null;
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
  const presenter = state.presenter;
  state.presenter = null;
  presenter?.unmount();
}

/** The normalized configuration of a tour. Internal. */
export function normalizedConfigOf(tour: Tour): NormalizedTourConfig {
  return internalsOf(tour).normalized;
}

/** Creates a tour. Safe to call on the server; `start()` needs a browser. */
export function createTour(config: TourConfig = {}): Tour {
  return new Tour(config);
}
