import { computed, defineComponent, inject, onBeforeUnmount, onMounted, provide, shallowRef } from "vue";
import type { InjectionKey, PropType, Ref, VNode } from "vue";
import { createTour } from "virtualtour";
import type { Tour, TourConfig, TourStep } from "virtualtour";

/** What {@link useTour} returns. `isRunning` and `currentStep` are readonly refs; the methods are stable. `currentStep` is the last step the tour reported with `step-shown`: it keeps the previous step while a move is under way and changes only when the new step is shown, or to `null` when the run ends or that step is dropped. */
export interface UseTourResult {
  tour: Tour;
  isRunning: Readonly<Ref<boolean>>;
  currentStep: Readonly<Ref<TourStep | null>>;
  start(): Promise<void>;
  forward(): Promise<void>;
  backward(): Promise<void>;
  exit(): Promise<boolean>;
  finish(): void;
}

const key: InjectionKey<UseTourResult> = Symbol("virtualtour-vue");

interface Gate {
  disposed: boolean;
  released: Promise<boolean>;
  release(): void;
}

function createGate(): Gate {
  const gate: Gate = { disposed: false, released: Promise.resolve(true), release: () => {} };
  gate.released = new Promise<boolean>((resolve) => {
    gate.release = () => resolve(true);
  });
  return gate;
}

function wrapExitPrompt(config: TourConfig, gate: Gate): TourConfig {
  const prompt = config.exitPrompt;
  if (prompt === undefined || prompt === false) return config;
  return {
    ...config,
    exitPrompt: async () => {
      if (gate.disposed) return true;
      return Promise.race([typeof prompt === "string" ? window.confirm(prompt) : prompt(), gate.released]);
    },
  };
}

/**
 * Creates one tour for its subtree and exposes it through {@link useTour}. The tour is created during setup (safe on
 * the server), `config` is read once, `autoStart` starts it once after mount, and unmounting ends a running tour
 * without the exit prompt.
 */
export const TourProvider = defineComponent({
  name: "TourProvider",
  props: {
    config: { type: Object as PropType<TourConfig>, required: true },
    autoStart: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const gate = createGate();
    const tour = createTour(wrapExitPrompt(props.config, gate));
    const running = shallowRef(false);
    const step = shallowRef<TourStep | null>(null);
    let offs: Array<() => void> = [];
    let offStep = (): void => {};

    const setShown = (next: TourStep | null): void => {
      if (step.value === next) return;
      offStep();
      step.value = next;
      offStep = next
        ? next.on("disposed", () => {
            if (step.value === next) setShown(null);
          })
        : () => {};
    };

    const sync = (): void => {
      running.value = tour.isRunning();
    };

    const exitWithoutPrompt = (): void => {
      gate.release();
      if (!tour.isRunning()) return;
      tour.exit().catch((error: unknown) => {
        console.error("[virtualtour-vue] exit on unmount failed:", error);
      });
    };

    tour.on("started", () => {
      queueMicrotask(() => {
        if (gate.disposed) exitWithoutPrompt();
      });
    });

    const value: UseTourResult = {
      tour,
      isRunning: computed(() => running.value),
      currentStep: computed(() => step.value),
      start: () => tour.start(),
      forward: () => tour.forward(),
      backward: () => tour.backward(),
      exit: () => tour.exit(),
      finish: () => tour.finish(),
    };
    provide(key, value);

    onMounted(() => {
      offs = [
        tour.on("step-shown", ({ step: shown }) => {
          setShown(shown);
          sync();
        }),
        ...(["started", "finished", "exited", "deactivated"] as const).map((event) =>
          tour.on(event, () => {
            setShown(null);
            sync();
          }),
        ),
      ];
      sync();
      if (props.autoStart && !tour.isRunning()) {
        value.start().catch((error: unknown) => {
          console.error("[virtualtour-vue] autoStart failed:", error);
        });
      }
    });

    onBeforeUnmount(() => {
      gate.disposed = true;
      offs.forEach((off) => off());
      offs = [];
      offStep();
      offStep = () => {};
      exitWithoutPrompt();
    });

    return (): VNode[] | undefined => slots.default?.();
  },
});

/** Reads the tour of the nearest {@link TourProvider}. Throws when called outside one. */
export function useTour(): UseTourResult {
  const value = inject(key, null);
  if (value === null) throw new Error("[virtualtour-vue] useTour() must be called inside a <TourProvider>.");
  return value;
}
