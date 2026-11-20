import { compileStepForShow, compileTour } from "./compile";
import type { EngineStep } from "./compile";
import { DEFAULT_HOOK_TIMEOUT_MS, normalizeTourConfig, resolveStepConfig } from "./config";
import type { NormalizedTourConfig } from "./config";
import { createEngine } from "./engine/driver";
import type { Config, DriveStep, Driver, EnginePresenter, PopoverPatch, RepositionInfo as EngineRepositionInfo } from "./engine/driver";
import { isDummyElement } from "./engine/core/utils";
import { isActionStep } from "./engine/tour/step";
import type { PopoverDOM } from "./engine/popover/popover";
import { TourEnvironmentError, TourNavigationError } from "./errors";
import { Emitter } from "./events";
import type { ExitReason, TourEvents } from "./events";
import { listenForAdvance } from "./advance/auto-advance";
import { resolveTarget, waitForTarget } from "./dom/target";
import { chain, NavigationQueue, raceAbort, resolveStepIndex, selectEligible } from "./navigator";
import type { NavigationOutcome } from "./navigator";
import { applyStateClasses, classList, dedupeExtras, parsableSelectors, removeStateClasses, resolveExtras, spotlitClass } from "./spotlight/options";
import { ProgressTracker } from "./persist/progress";
import { DialogPresenter } from "./presenter";
import { memoizeSanitizer } from "./render/content";
import { relayTourEvent, setCurrentTour, tours } from "./registry";
import { emitStep, lookupTarget, markHidden, markShown, resetStep, retireStep, setConfiguredHook, setResolvedTarget, TourStep } from "./step";
import type { Presenter, ProgressInfo, ProgressRecord, RepositionInfo, StepConfig, StepParts, TourConfig } from "./types";

declare const __DEV__: boolean | undefined;

const WAITING_CLASS = "vt-waiting";

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
  mounted: { popover: PopoverDOM; step: TourStep; parts: StepParts } | null;
  advance: { step: TourStep; detach: () => void; timer: ReturnType<typeof setTimeout> | null } | null;
  waits: Map<TourStep, AbortController>;
  warnedUnnamed: boolean;
  warnedStyles: boolean;
  completing: TourStep | null;
  progress: ProgressTracker | null;
  starting: boolean;
  clearSanitized: () => void;
  spotlit: Map<Element, { wanted: string[]; added: string[] }>;
  spotlitStep: TourStep | null;
  abandoned: WeakSet<TourStep>;
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
    let clearSanitized = (): void => {};
    if (normalized.sanitize) {
      const memo = memoizeSanitizer(normalized.sanitize);
      normalized.sanitize = memo.sanitize;
      clearSanitized = memo.clear;
    }
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
      advance: null,
      waits: new Map(),
      warnedUnnamed: false,
      warnedStyles: false,
      completing: null,
      progress: normalized.progress ? new ProgressTracker(normalized.id, normalized.progress) : null,
      starting: false,
      clearSanitized,
      spotlit: new Map(),
      spotlitStep: null,
      abandoned: new WeakSet(),
    };
    internals.set(this, state);
    if (normalized.progress && config.id === undefined && (typeof __DEV__ === "undefined" || __DEV__)) {
      console.warn("[virtualtour] A tour with `progress` has no `id`, so its saved progress cannot match across page loads. Set a stable `id`.");
    }
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

  /** The 1-based position of the step on screen (0 when none) and the number of steps, skipped ones included. */
  progressInfo(): ProgressInfo {
    const state = internalsOf(this);
    return { index: state.currentIndex + 1, total: state.steps.length };
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
    if (state.running) {
      syncEngineSteps(this);
      refreshProgress(this);
    }
    return step;
  }

  /**
   * Removes a step by id or instance; an unknown reference does nothing. While a run is active the step is disposed
   * at once; if it was on screen, or a move had begun showing it, the tour shows the step that now follows it, or exits
   * with reason `api` without a prompt when none does. A drop never finishes the tour.
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
    if (wasTarget) state.abandoned.add(step);
    state.waits.get(step)?.abort();
    leaveStep(this, step);
    state.steps.splice(index, 1);
    if (index < state.currentIndex) state.currentIndex -= 1;
    if (index < state.anchorIndex) state.anchorIndex -= 1;
    else if (index === state.anchorIndex) state.anchorIndex = index - 1;
    step.dispose();
    retireStep(step);
    if (state.engine) {
      syncEngineSteps(this);
      refreshProgress(this);
    }
    if (wasTarget) settle(state);
    if (!wasVisible && !wasTarget) return;
    reportFailure(state.queue.enqueue(() => resumeAfterDrop(this, index - 1)));
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
    const state = internalsOf(this);
    if (state.running || state.starting) return;
    let resumeAt = -1;
    const progress = state.progress;
    if (progress) {
      state.starting = true;
      let record: ProgressRecord | null;
      try {
        record = await progress.load();
      } finally {
        state.starting = false;
      }
      if (state.running) return;
      if (record?.completedAt !== undefined && progress.skipCompleted) {
        emitTour(this, "bypassed", { tour: this, reason: "completed" });
        return;
      }
      if (progress.resume && record?.lastStepId !== undefined) resumeAt = state.steps.findIndex((s) => s.id === record.lastStepId);
    }
    if (!beginRun(this)) return;
    if (resumeAt <= 0) {
      await navigateGuarded(this, () => runNavigation(this, "forward"));
      return;
    }
    const runId = state.runId;
    await navigateGuarded(this, () => {
      if (!state.running || state.ending || state.runId !== runId) return Promise.resolve();
      const outcome = advanceFrom(this, resumeAt - 1, "forward");
      return Promise.resolve(chain(outcome, (o) => concludeNavigation(this, runId, o)));
    });
  }

  /**
   * Moves to the next step, or finishes after the last one. Does nothing while no run is active. While the step on
   * screen is an action step whose instruction is not met, it nudges instead of moving, whoever calls it: a custom
   * `forward` button, the page, or the keyboard. Only `forward` is gated: `goTo`, `backward` and `exit` are not. A
   * step's own completion passes the gate; nothing else does.
   */
  forward(): Promise<void> {
    const state = internalsOf(this);
    if (state.running && !state.ending && state.engine?.isActive() && state.engine.nudgeIfGated()) return Promise.resolve();
    return navigate(this, "forward");
  }

  /**
   * Completes the action step on screen as if the user had done what its instruction asks: emits `completed`, then
   * `step-completed`, waits the step's `advanceDelay` and moves forward. While the tour is still moving away from the step, repeated calls and gestures complete nothing more.
   * On a step without an instruction it only moves forward, with no events. Does nothing while no step is on screen or
   * the step is still waiting for its target.
   */
  advance(): void {
    const engine = internalsOf(this).engine;
    if (engine?.isActive()) engine.advance();
  }

  /**
   * Shakes the popover (a flash under reduced motion) and calls the presenter's `onNudge`. A `message` is shown in
   * the feedback row as HTML that passes through `sanitize`; without one the row is cleared. Does nothing while no step is on screen.
   */
  nudge(message?: string): void {
    const engine = internalsOf(this).engine;
    if (engine?.isActive()) engine.nudge(message);
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
    await navigateGuarded(this, () => {
      const index = ref === undefined ? Math.max(state.anchorIndex, 0) : resolveStepIndex(state.steps, ref);
      const step = state.steps[index];
      if (step && step.isShown() && state.engine?.isActive()) return Promise.resolve();
      const runId = state.runId;
      const backward = index < state.anchorIndex;
      const outcome = advanceFrom(this, backward ? index + 1 : index - 1, backward ? "backward" : "forward", step ?? null);
      return Promise.resolve(chain(outcome, (o) => concludeNavigation(this, runId, o)));
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
    releaseSpotlit(this, state);
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

function reportFailure(promise: Promise<unknown>): Promise<void> {
  return promise.then(
    () => {},
    (error: unknown) => console.error("[virtualtour] Navigation failed:", error)
  );
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

function detachAdvance(state: TourInternals, only?: TourStep): void {
  const advance = state.advance;
  if (!advance || (only !== undefined && advance.step !== only)) return;
  state.advance = null;
  if (advance.timer !== null) clearTimeout(advance.timer);
  advance.detach();
}

function releaseSpotlit(tour: Tour, state: TourInternals): void {
  for (const [element, held] of state.spotlit) removeStateClasses(element, held.added, tour);
  state.spotlit.clear();
  state.spotlitStep = null;
}

function markSpotlit(tour: Tour, step: TourStep, target: Element | undefined): void {
  const state = internalsOf(tour);
  state.spotlitStep = step;
  const spotlight = step.config.spotlight;
  const marker = spotlitClass(state.normalized.namespace);
  const wanted = [marker, ...classList(spotlight?.class)];
  const desired = new Set<Element>();
  if (target) desired.add(target);
  for (const extra of dedupeExtras(resolveExtras(parsableSelectors(spotlight?.extra)), target)) desired.add(extra);
  for (const [element, held] of state.spotlit) {
    if (desired.has(element) && held.wanted.join(" ") === wanted.join(" ")) continue;
    removeStateClasses(element, held.added, tour);
    state.spotlit.delete(element);
  }
  for (const element of desired) {
    if (state.spotlit.has(element)) continue;
    state.spotlit.set(element, { wanted, added: applyStateClasses(element, wanted, tour) });
  }
}

function remarkSpotlit(tour: Tour, state: TourInternals): void {
  const step = state.spotlitStep;
  const active = state.engine?.getState("activeElement");
  if (!step || state.ending) return;
  markSpotlit(tour, step, active && !isDummyElement(active) ? active : undefined);
}

function stepOf(tour: Tour, driveStep: DriveStep | undefined): TourStep | undefined {
  const step = driveStep?.data?.["vt"] as TourStep | undefined;
  return step && internalsOf(tour).steps.includes(step) ? step : undefined;
}

function leaveStep(tour: Tour, step: TourStep): void {
  const state = internalsOf(tour);
  detachAdvance(state, step);
  if (!step.isShown()) return;
  guarded("presenter.beforeLeave", () => state.presenter?.beforeLeave(step));
  emitStep(step, "will-hide", { step });
  markHidden(step);
  if (state.steps[state.currentIndex] === step) state.currentIndex = -1;
  state.previousStep = step;
  emitStep(step, "hidden", { step });
}

function enginePresenterFor(tour: Tour, presenter: Presenter): EnginePresenter {
  const state = internalsOf(tour);
  const adapter: EnginePresenter = {
    mount(popover, driveStep) {
      const step = stepOf(tour, driveStep);
      if (!step) return;
      const parts: StepParts = { buttons: [] };
      const content = driveStep?.data?.["vtBody"] as Element | DocumentFragment | undefined;
      if (content) parts.content = content;
      state.mounted = { popover, step, parts };
      guarded("presenter.mount", () => presenter.mount(popover, step, parts));
    },
    afterReposition(info: EngineRepositionInfo) {
      const mounted = state.mounted;
      if (!mounted) return;
      const full: RepositionInfo = {
        side: info.side,
        align: info.align,
        wrapperRect: info.wrapperRect,
        bubbleRect: info.bubbleRect,
        physicalAlign: info.physicalAlign,
        rtl: info.rtl,
        pinned: info.pinned,
        targetRect: info.targetRect,
      };
      guarded("presenter.afterReposition", () => presenter.afterReposition(mounted.popover, mounted.step, full));
    },
  };
  if (presenter.layout !== undefined) adapter.layout = presenter.layout;
  return adapter;
}

function warnIfUnnamed(tour: Tour, step: TourStep, out: EngineStep): void {
  const state = internalsOf(tour);
  if (state.warnedUnnamed || (typeof __DEV__ !== "undefined" && !__DEV__)) return;
  if (out.popover?.title || out.popover?.label) return;
  state.warnedUnnamed = true;
  console.warn(`[virtualtour] Step "${step.id}" has no title and no label, so its dialog has no accessible name. Set one of them.`);
}

function warnIfStylesMissing(tour: Tour, wrapper: HTMLElement): void {
  const state = internalsOf(tour);
  if (state.warnedStyles || (typeof __DEV__ !== "undefined" && !__DEV__)) return;
  state.warnedStyles = true;
  if (getComputedStyle(wrapper).getPropertyValue("--vt-base").trim() !== "") return;
  console.warn("[virtualtour] base.css is not loaded, so the popover is unstyled. Import `virtualtour/base.css`.");
}

function evaluatedStep(tour: Tour, index: number): EngineStep {
  const state = internalsOf(tour);
  const step = state.steps[index] as TourStep;
  const out = compileStepForShow(step, state.normalized.dimOptions.radius, state.normalized.sanitize);
  if (out.skipMissingElement && step.config.target !== undefined && lookupTarget(step) === null) out.skipMissingElement = false;
  warnIfUnnamed(tour, step, out);
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

function shownPopover(tour: Tour, step?: TourStep): { engine: Driver; mounted: NonNullable<TourInternals["mounted"]> } | null {
  const state = internalsOf(tour);
  const engine = state.engine;
  const mounted = state.mounted;
  const current = state.steps[state.currentIndex];
  if (!engine || !mounted || !current || !engine.isActive() || mounted.step !== current) return null;
  if (step && step !== current) return null;
  if (!mounted.popover.wrapper.isConnected) return null;
  return { engine, mounted };
}

function counterText(tour: Tour): string | undefined {
  const state = internalsOf(tour);
  const counter = state.normalized.counter;
  if (counter === false) return undefined;
  const { index, total } = tour.progressInfo();
  if (typeof counter !== "function") return `${index} of ${total}`;
  try {
    return counter(index, total);
  } catch (error) {
    console.error("[virtualtour] counter threw:", error);
    return undefined;
  }
}

function refreshProgress(tour: Tour): void {
  const shown = shownPopover(tour);
  if (!shown) return;
  const text = counterText(tour);
  if (text !== undefined) shown.engine.updatePopover({ progressText: text });
}

function refreshShownStep(step: TourStep): void {
  const tour = step.tour;
  const state = internalsOf(tour);
  const shown = shownPopover(tour, step);
  if (!shown) return;
  let out: EngineStep;
  try {
    out = evaluatedStep(tour, state.steps.indexOf(step));
  } catch (error) {
    console.error("[virtualtour] configure could not re-evaluate the step; the popover is unchanged:", error);
    return;
  }
  const popover = out.popover ?? {};
  const patch: PopoverPatch = {
    title: popover.title ?? "",
    description: popover.description ?? "",
    label: popover.label ?? "",
    popoverClass: popover.popoverClass ?? "",
    closeBtnLabel: popover.closeBtnLabel ?? state.normalized.labels.close,
  };
  if (popover.showButtons !== undefined) patch.showButtons = popover.showButtons;
  if (popover.instruction !== undefined) patch.instruction = popover.instruction;
  const text = typeof state.normalized.counter === "function" ? popover.progressText : counterText(tour);
  if (text !== undefined) patch.progressText = text;
  const { engine, mounted } = shown;
  const content = out.data?.["vtBody"] as Element | DocumentFragment | undefined;
  if (content) mounted.parts.content = content;
  else delete mounted.parts.content;
  engine.updatePopover(patch);
  const presenter = state.presenter;
  if (presenter) guarded("presenter.update", () => presenter.update(mounted.popover, step, mounted.parts));
  engine.refresh();
}

setConfiguredHook(refreshShownStep);

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
  const isLeavingAfterCompletion = (driveStep: DriveStep): boolean => {
    const step = stepOf(tour, driveStep);
    return step !== undefined && state.completing === step && state.queue.busy;
  };
  const config = {
    ...compiled.base,
    steps: compiled.steps,
    presenter: enginePresenterFor(tour, presenter),
    onHighlightStarted(element: Element | undefined, driveStep: DriveStep) {
      if (!owns()) return;
      const step = stepOf(tour, driveStep);
      if (!step) return;
      state.anchorIndex = state.steps.indexOf(step);
      markSpotlit(tour, step, element);
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
      state.completing = null;
      markShown(step, popover.wrapper, element ?? null);
      warnIfStylesMissing(tour, popover.wrapper);
      const index = state.steps.indexOf(step);
      state.currentIndex = index;
      state.anchorIndex = index;
      guarded("presenter.afterShow", () => presenter.afterShow(popover, step));
      attachAdvance(tour, step);
      emitStep(step, "shown", { step });
      state.progress?.stepShown(step.id);
      emitTour(tour, "step-shown", { tour, step, previous: state.previousStep });
      settle(state);
    },
    onDeselected(_element: Element | undefined, driveStep: DriveStep, opts: { reason?: string | undefined }) {
      if (!owns()) return;
      if (opts.reason !== undefined) releaseSpotlit(tour, state);
      const step = stepOf(tour, driveStep);
      if (step) leaveStep(tour, step);
    },
    onStepCompleted(_element: Element | undefined, driveStep: DriveStep) {
      if (!owns()) return;
      const step = stepOf(tour, driveStep);
      if (step && state.completing === step && state.queue.busy) {
        return;
      }
      state.completing = step ?? null;
      if (!driveStep.popover?.instruction || !step) return;
      guarded("presenter.onCompleted", () => presenter.onCompleted?.(step));
      emitStep(step, "completed", { step });
      emitTour(tour, "step-completed", { tour, step });
    },
    onReposition() {
      if (owns()) remarkSpotlit(tour, state);
    },
    onNudge(driveStep: DriveStep) {
      if (!owns()) return;
      const step = stepOf(tour, driveStep);
      if (step) guarded("presenter.onNudge", () => presenter.onNudge?.(step));
    },
    onNextClick(_element: Element | undefined, driveStep: DriveStep) {
      if (!owns() || isLeavingAfterCompletion(driveStep)) return;
      return reportFailure(tour.forward());
    },
    onDoneClick(_element: Element | undefined, driveStep: DriveStep) {
      if (!owns() || isLeavingAfterCompletion(driveStep)) return;
      return reportFailure(tour.forward());
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

const PRESENTER_READY_TIMEOUT_MS = 10_000;

async function showStep(tour: Tour, index: number): Promise<void> {
  const state = internalsOf(tour);
  const step = state.steps[index];
  if (!state.running || state.ending || !step) return;
  if (step.isShown() && state.engine?.isActive()) return;
  if (!state.engine) {
    const runId = state.runId;
    const ready = guardedReady(presenterOf(tour), () => isLive(state, runId));
    if (ready) {
      await ready;
      if (!isLive(state, runId)) return;
    }
  }
  const engine = ensureEngine(tour);
  evaluateStepInto(tour, index);
  settle(state);
  const shown = new Promise<void>((resolve) => {
    state.waiter = resolve;
  });
  engine.moveTo(index);
  await shown;
}

function guardedReady(presenter: Presenter, live: () => boolean): Promise<void> | undefined {
  const failed = (error: unknown): void => {
    console.warn("[virtualtour] presenter.ready failed", error);
  };
  let pending: Promise<void> | undefined;
  try {
    pending = presenter.ready?.();
  } catch (error) {
    failed(error);
    return undefined;
  }
  if (!pending) return undefined;
  const ready = pending;
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (live()) console.warn(`[virtualtour] presenter.ready did not settle within ${PRESENTER_READY_TIMEOUT_MS} ms; showing the first step without it`);
      resolve();
    }, PRESENTER_READY_TIMEOUT_MS);
    ready.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        failed(error);
        resolve();
      },
    );
  });
}

function attachAdvance(tour: Tour, step: TourStep): void {
  const state = internalsOf(tour);
  detachAdvance(state);
  const auto = step.config.autoAdvance;
  if (auto?.selector === undefined) return;
  if (!isValidSelector(auto.selector)) {
    if (typeof __DEV__ === "undefined" || __DEV__) {
      console.warn(`[virtualtour] Step "${step.id}" has an invalid autoAdvance selector ${JSON.stringify(auto.selector)}; it will never advance.`);
    }
    return;
  }
  const advance: NonNullable<TourInternals["advance"]> = { step, detach: () => {}, timer: null };
  advance.detach = listenForAdvance(auto.selector, auto.event, () => {
    advance.timer = setTimeout(() => {
      if (state.advance === advance) state.advance = null;
      advance.timer = null;
      if (!state.running || state.ending || state.steps[state.currentIndex] !== step) return;
      const engine = state.engine;
      if (engine && isActionStep(engine.getState("__activation")?.step)) {
        if (state.steps[state.anchorIndex] === step) engine.advance();
        return;
      }
      reportFailure(
        navigateGuarded(tour, () => (state.steps[state.anchorIndex] === step ? runNavigation(tour, "forward") : Promise.resolve()))
      );
    }, 0);
  });
  state.advance = advance;
}

function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function isLive(state: TourInternals, runId: number): boolean {
  return state.running && !state.ending && state.runId === runId;
}

function passesShouldShow(step: TourStep): boolean {
  const check = step.config.shouldShow;
  if (!check) return true;
  try {
    return Boolean(check());
  } catch (error) {
    console.error("[virtualtour] shouldShow threw; the step is skipped:", error);
    return false;
  }
}

function markWaiting(state: TourInternals): () => void {
  const engine = state.engine;
  const popover = engine?.isActive() && state.currentIndex >= 0 ? (engine.getState("popover") as PopoverDOM | undefined) : undefined;
  const wrapper = popover?.wrapper;
  if (!wrapper) return () => {};
  wrapper.classList.add(WAITING_CLASS);
  wrapper.setAttribute("aria-busy", "true");
  return () => {
    wrapper.classList.remove(WAITING_CLASS);
    wrapper.removeAttribute("aria-busy");
  };
}

interface WaitBudget {
  left: number;
  waited: boolean;
}

function checkEligible(
  tour: Tour,
  step: TourStep,
  runId: number,
  forced: boolean,
  found: Map<TourStep, Element | null>,
  budget: WaitBudget
): boolean | Promise<boolean> {
  const state = internalsOf(tour);
  if (!state.steps.includes(step) || !isLive(state, runId)) return false;
  if (!forced && !passesShouldShow(step)) return false;
  const config = step.config;
  if (config.target === undefined) {
    found.set(step, null);
    return true;
  }
  const verdict = (target: Element | null): boolean => {
    if (!target && !forced && config.whenMissing === "skip") return false;
    found.set(step, target);
    return true;
  };
  const target = resolveTarget(config.target);
  const requested = config.waitFor ?? 0;
  if (target || !(requested > 0)) return verdict(target);
  const wait = budget.waited ? Math.min(requested, budget.left) : requested;
  if (wait < requested) {
    console.warn(
      `[virtualtour] Step "${step.id}" waits ${wait > 0 ? `only ${wait} ms` : "no longer"} for its target: the navigation spent its waitBudget of ${state.normalized.waitBudget} ms.`
    );
  }
  if (!(wait > 0)) return verdict(target);
  budget.waited = true;
  const waitStart = Date.now();
  const release = markWaiting(state);
  const waiting = new AbortController();
  const runSignal = state.abort?.signal ?? null;
  const relay = (): void => waiting.abort();
  if (runSignal?.aborted) waiting.abort();
  else runSignal?.addEventListener("abort", relay, { once: true });
  state.waits.set(step, waiting);
  const done = (): void => {
    budget.left = Math.max(0, budget.left - (Date.now() - waitStart));
    release();
    runSignal?.removeEventListener("abort", relay);
    if (state.waits.get(step) === waiting) state.waits.delete(step);
  };
  return waitForTarget(config.target, wait, waiting.signal).then(
    (late) => {
      done();
      return isLive(state, runId) && state.steps.includes(step) && verdict(late);
    },
    (error: unknown) => {
      done();
      throw error;
    }
  );
}

function newWaitBudget(tour: Tour): WaitBudget {
  const cap = internalsOf(tour).normalized.waitBudget;
  return { left: cap > 0 ? cap : Infinity, waited: false };
}

function advanceFrom(
  tour: Tour,
  from: number,
  direction: "forward" | "backward",
  forcedStep: TourStep | null = null,
  budget: WaitBudget = newWaitBudget(tour)
): NavigationOutcome | Promise<NavigationOutcome> {
  const state = internalsOf(tour);
  const runId = state.runId;
  const snapshot = state.steps.slice();
  const found = new Map<TourStep, Element | null>();
  const picked = selectEligible(snapshot.length, from, direction, (index) =>
    checkEligible(tour, snapshot[index] as TourStep, runId, snapshot[index] === forcedStep, found, budget)
  );
  return chain(picked, (outcome) => {
    if (!isLive(state, runId)) return { kind: "stay" } as NavigationOutcome;
    if (outcome.kind !== "show") return outcome.kind === "finish" && snapshot.some((s) => !state.steps.includes(s)) ? { kind: "exit" } : outcome;
    const step = snapshot[outcome.index] as TourStep;
    return chain(presentStep(tour, step, found.get(step) ?? null), (): NavigationOutcome | Promise<NavigationOutcome> => {
      if (!isLive(state, runId)) return { kind: "stay" };
      if (state.steps.includes(step)) return { kind: "show", index: state.steps.indexOf(step) };
      if (state.abandoned.has(step)) {
        const resumed = advanceFrom(tour, resumePoint(state, snapshot, outcome.index, "forward"), "forward", null, budget);
        return chain(resumed, (o): NavigationOutcome => (o.kind === "finish" ? { kind: "exit" } : o));
      }
      const next = advanceFrom(tour, resumePoint(state, snapshot, outcome.index, direction), direction, null, budget);
      return chain(next, (o): NavigationOutcome => (o.kind === "finish" ? { kind: "exit" } : o));
    });
  });
}

function resumePoint(state: TourInternals, snapshot: readonly TourStep[], droppedAt: number, direction: "forward" | "backward"): number {
  if (direction === "forward") {
    for (let i = droppedAt - 1; i >= 0; i -= 1) {
      const at = state.steps.indexOf(snapshot[i] as TourStep);
      if (at >= 0) return at;
    }
    return -1;
  }
  for (let i = droppedAt + 1; i < snapshot.length; i += 1) {
    const at = state.steps.indexOf(snapshot[i] as TourStep);
    if (at >= 0) return at;
  }
  return state.steps.length;
}

function concludeNavigation(tour: Tour, runId: number, outcome: NavigationOutcome): void {
  const state = internalsOf(tour);
  if (!isLive(state, runId)) return;
  if (outcome.kind === "finish") terminate(tour, "finished");
  else if (outcome.kind === "exit") terminate(tour, "api");
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null | undefined)?.then === "function";
}

function runHook(label: string, call: () => unknown, signal: AbortSignal | null, timeoutMs: number): void | Promise<void> {
  const report = (error: unknown): void => console.error(`[virtualtour] ${label} threw; the step still shows:`, error);
  let result: unknown;
  try {
    result = call();
  } catch (error) {
    report(error);
    return;
  }
  if (!isThenable(result)) return;
  const pending = Promise.resolve(result);
  if (!(timeoutMs > 0) || timeoutMs === Infinity) return raceAbort(pending, signal).then(() => undefined, report);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[virtualtour] ${label} did not settle within ${timeoutMs} ms; the step shows anyway.`);
      resolve();
    }, Math.min(timeoutMs, 2 ** 31 - 1));
  });
  pending.catch(() => undefined);
  return raceAbort(Promise.race([pending, expired]), signal).then(
    () => clearTimeout(timer),
    (error: unknown) => {
      clearTimeout(timer);
      report(error);
    }
  );
}

function presentStep(tour: Tour, step: TourStep, found: Element | null): void | Promise<void> {
  const state = internalsOf(tour);
  if (!state.steps.includes(step)) return;
  const runId = state.runId;
  const signal = state.abort?.signal ?? null;
  if (step.isShown() && state.engine?.isActive()) return;
  const { prepare, revealWith } = step.config;
  const timeoutMs = step.config.hookTimeout ?? DEFAULT_HOOK_TIMEOUT_MS;
  const reveal = (): void | Promise<void> => {
    if (!isLive(state, runId)) return;
    const target = found && !found.isConnected ? resolveTarget(step.config.target) : found;
    const revealing = target && revealWith ? runHook("revealWith", () => revealWith(target), signal, timeoutMs) : undefined;
    return chain(revealing, () => {
      if (!isLive(state, runId)) return;
      const current = state.steps.indexOf(step);
      if (current < 0) return;
      setResolvedTarget(step, target && target.isConnected ? target : null);
      return showStep(tour, current);
    });
  };
  return chain(prepare ? runHook("prepare", () => prepare(), signal, timeoutMs) : undefined, reveal);
}

function resumeAfterDrop(tour: Tour, from: number): Promise<void> {
  const state = internalsOf(tour);
  const runId = state.runId;
  return Promise.resolve(
    chain(advanceFrom(tour, from, "forward"), (outcome) => {
      if (!isLive(state, runId) || outcome.kind === "show" || outcome.kind === "stay") return;
      state.anchorIndex = -1;
      terminate(tour, "api");
    })
  );
}

function runNavigation(tour: Tour, direction: "forward" | "backward"): Promise<void> {
  const state = internalsOf(tour);
  if (!state.running || state.ending) return Promise.resolve();
  const runId = state.runId;
  return Promise.resolve(chain(advanceFrom(tour, state.anchorIndex, direction), (outcome) => concludeNavigation(tour, runId, outcome)));
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
  detachAdvance(state);
  const endStep = hookStep ?? state.steps[state.currentIndex] ?? state.steps[state.anchorIndex];
  for (const step of state.steps) leaveStep(tour, step);
  releaseSpotlit(tour, state);
  if (kind === "finished") {
    state.progress?.finished();
    if (endStep) emitStep(endStep, "finished", { step: endStep });
    emitTour(tour, "finished", { tour });
  } else {
    if (kind !== "replaced") state.progress?.exited(endStep?.id);
    if (endStep) emitStep(endStep, "exited", { step: endStep });
    emitTour(tour, "exited", { tour, reason: kind });
  }
  for (const step of state.steps.slice()) step.dispose();
  guarded("presenter.unmount", () => releasePresenter(tour));
  state.abort?.abort();
  state.abort = null;
  state.queue.cancelWaiting();
  state.clearSanitized();
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
    ? state.normalized.presenter(tour, {
        namespace: state.normalized.namespace,
        ...(state.normalized.sanitize ? { sanitize: state.normalized.sanitize } : {}),
        fadeMs: state.normalized.animate ? state.normalized.dimOptions.transitionMs : 0,
      })
    : new DialogPresenter(tour, state.normalized.namespace, state.normalized.sanitize);
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
