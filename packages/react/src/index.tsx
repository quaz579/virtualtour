import { createContext, createElement, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import { createTour } from "virtual-site-tour";
import type { Tour, TourConfig, TourStep } from "virtual-site-tour";

/** Props of {@link TourProvider}. */
export interface TourProviderProps {
  /** Read once, when the provider mounts. Pass a new `key` to the provider to rebuild the tour from a new config. */
  config: TourConfig;
  /** Start the tour once, after the provider mounts. Ignored while a run is already active. */
  autoStart?: boolean;
  children?: ReactNode;
}

/** What {@link useTour} returns. `isRunning` and `currentStep` update on the tour events started, step-shown, finished, exited and deactivated, and when the step on screen is dropped. `currentStep` is the last step the tour reported with `step-shown` (use `tour.currentStep` for the live value during a move): it keeps the previous step while a move is under way and changes only when the new step is shown, or to `null` when the run ends or that step is dropped. `hideCurrent()` leaves it unchanged. The methods are stable across renders. */
export interface UseTourResult {
  tour: Tour;
  isRunning: boolean;
  currentStep: TourStep | null;
  start(): Promise<void>;
  forward(): Promise<void>;
  backward(): Promise<void>;
  exit(): Promise<boolean>;
  finish(): void;
}

interface Snapshot {
  isRunning: boolean;
  currentStep: TourStep | null;
}

interface TourStore {
  tour: Tour;
  disposed: boolean;
  disposePending: boolean;
  shown: TourStep | null;
  releaseShown(): void;
  released: Promise<boolean>;
  releasePrompts(): void;
  arm(): void;
  snapshot: Snapshot;
  getSnapshot(): Snapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
  actions: Omit<UseTourResult, "tour" | "isRunning" | "currentStep">;
}

const serverSnapshot: Snapshot = { isRunning: false, currentStep: null };
const watched = ["started", "step-shown", "finished", "exited", "deactivated"] as const;

function createStore(config: TourConfig): TourStore {
  const prompt = config.exitPrompt;
  const wrapped: TourConfig =
    prompt === undefined || prompt === false
      ? config
      : {
          ...config,
          exitPrompt: async () => {
            if (store.disposed) return true;
            return Promise.race([typeof prompt === "string" ? window.confirm(prompt) : prompt(), store.released]);
          },
        };
  const tour = createTour(wrapped);
  const store: TourStore = {
    tour,
    released: Promise.resolve(true),
    releasePrompts: () => {},
    arm() {
      store.released = new Promise<boolean>((resolve) => {
        store.releasePrompts = () => resolve(true);
      });
    },
    disposed: false,
    disposePending: false,
    shown: null,
    releaseShown: () => {},
    snapshot: { isRunning: false, currentStep: null },
    getSnapshot() {
      const isRunning = tour.isRunning();
      const currentStep = store.shown;
      if (store.snapshot.isRunning !== isRunning || store.snapshot.currentStep !== currentStep) {
        store.snapshot = { isRunning, currentStep };
      }
      return store.snapshot;
    },
    subscribe(listener) {
      let tracked: TourStep | null = null;
      let offStep = (): void => {};
      const notify = (): void => {
        track();
        listener();
      };
      const track = (): void => {
        const current = store.shown;
        if (current === tracked) return;
        offStep();
        tracked = current;
        offStep = current
          ? current.on("disposed", () => {
              if (store.shown === current) store.shown = null;
              notify();
            })
          : () => {};
      };
      track();
      const offs = watched.map((event) => tour.on(event, notify));
      return () => {
        offs.forEach((off) => off());
        offStep();
      };
    },
    dispose() {
      store.disposed = true;
      store.releaseShown();
      exitWithoutPrompt(store);
    },
    actions: {
      start: () => tour.start(),
      forward: () => tour.forward(),
      backward: () => tour.backward(),
      exit: () => tour.exit(),
      finish: () => tour.finish(),
    },
  };
  store.arm();
  let offShownDisposed = (): void => {};
  store.releaseShown = () => {
    offShownDisposed();
    offShownDisposed = () => {};
  };
  tour.on("step-shown", ({ step }) => {
    offShownDisposed();
    offShownDisposed = () => {};
    if (!step.isShown()) {
      store.shown = null;
      return;
    }
    store.shown = step;
    offShownDisposed = step.on("disposed", () => {
      if (store.shown === step) store.shown = null;
    });
  });
  for (const event of ["started", "finished", "exited", "deactivated"] as const) {
    tour.on(event, () => {
      offShownDisposed();
      offShownDisposed = () => {};
      store.shown = null;
    });
  }
  tour.on("started", () => {
    queueMicrotask(() => {
      if (store.disposed) exitWithoutPrompt(store);
    });
  });
  return store;
}

function exitWithoutPrompt(store: TourStore): void {
  store.releasePrompts();
  if (!store.tour.isRunning()) return;
  store.tour.exit().catch((error: unknown) => {
    console.error("[virtualtour-react] exit on unmount failed:", error);
  });
}

const TourContext = createContext<UseTourResult | null>(null);

/**
 * Creates one tour for its subtree and exposes it through {@link useTour}. The tour is created during the first
 * render (safe on the server), starts only in an effect, and ends without an exit prompt when the provider unmounts.
 * React strict mode's extra mount and unmount cycle neither starts a second run nor ends the first.
 */
export function TourProvider(props: TourProviderProps): ReactElement {
  const { config, autoStart = false, children } = props;
  const [store] = useState(() => createStore(config));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverSnapshot);

  useEffect(() => {
    store.disposePending = false;
    if (store.disposed) {
      store.disposed = false;
      store.arm();
    }
    return () => {
      store.disposePending = true;
      queueMicrotask(() => {
        if (!store.disposePending) return;
        store.disposePending = false;
        store.dispose();
      });
    };
  }, [store]);

  useEffect(() => {
    if (!autoStart || store.tour.isRunning()) return;
    store.actions.start().catch((error: unknown) => {
      console.error("[virtualtour-react] autoStart failed:", error);
    });
  }, [store, autoStart]);

  const value = useMemo<UseTourResult>(
    () => ({ tour: store.tour, isRunning: snapshot.isRunning, currentStep: snapshot.currentStep, ...store.actions }),
    [store, snapshot],
  );
  return createElement(TourContext.Provider, { value }, children);
}

/** Reads the tour of the nearest {@link TourProvider}. Throws when called outside one. */
export function useTour(): UseTourResult {
  const value = useContext(TourContext);
  if (value === null) throw new Error("[virtualtour-react] useTour() must be called inside a <TourProvider>.");
  return value;
}
