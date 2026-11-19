import { createContext, createElement, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { createTour } from "virtualtour";
import type { Tour, TourConfig, TourStep } from "virtualtour";

/** Props of {@link TourProvider}. */
export interface TourProviderProps {
  /** Read once, when the provider mounts. Pass a new `key` to the provider to rebuild the tour from a new config. */
  config: TourConfig;
  /** Start the tour once, after the provider mounts. Ignored while a run is already active. */
  autoStart?: boolean;
  children?: ReactNode;
}

/** What {@link useTour} returns. `isRunning` and `currentStep` are reactive; the methods are stable across renders. */
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
  disposeTimer: ReturnType<typeof setTimeout> | null;
  gate: { bypass: boolean };
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
  const gate = { bypass: false };
  const wrapped: TourConfig =
    prompt === undefined || prompt === false
      ? config
      : {
          ...config,
          exitPrompt: async () => {
            if (gate.bypass) return true;
            return typeof prompt === "string" ? window.confirm(prompt) : prompt();
          },
        };
  const tour = createTour(wrapped);
  const store: TourStore = {
    tour,
    gate,
    disposed: false,
    disposeTimer: null,
    snapshot: { isRunning: false, currentStep: null },
    getSnapshot() {
      const isRunning = tour.isRunning();
      const currentStep = tour.currentStep;
      if (store.snapshot.isRunning !== isRunning || store.snapshot.currentStep !== currentStep) {
        store.snapshot = { isRunning, currentStep };
      }
      return store.snapshot;
    },
    subscribe(listener) {
      const offs = watched.map((event) => tour.on(event, listener));
      return () => offs.forEach((off) => off());
    },
    dispose() {
      store.disposed = true;
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
  tour.on("started", () => {
    queueMicrotask(() => {
      if (store.disposed) exitWithoutPrompt(store);
    });
  });
  return store;
}

function exitWithoutPrompt(store: TourStore): void {
  if (!store.tour.isRunning()) return;
  store.gate.bypass = true;
  void store.tour.exit().finally(() => {
    store.gate.bypass = false;
  });
}

const TourContext = createContext<UseTourResult | null>(null);

/**
 * Creates one tour for its subtree and exposes it through {@link useTour}. The tour is created during the first
 * render (safe on the server), starts only in an effect, and ends without an exit prompt when the provider unmounts.
 * React strict mode's extra mount and unmount cycle neither starts a second run nor ends the first.
 */
export function TourProvider(props: TourProviderProps): ReactNode {
  const { config, autoStart = false, children } = props;
  const [store] = useState(() => createStore(config));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverSnapshot);

  useEffect(() => {
    if (store.disposeTimer !== null) {
      clearTimeout(store.disposeTimer);
      store.disposeTimer = null;
    }
    store.disposed = false;
    return () => {
      store.disposeTimer = setTimeout(() => {
        store.disposeTimer = null;
        store.dispose();
      }, 0);
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
