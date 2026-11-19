import { computed, defineComponent, inject, onBeforeUnmount, onMounted, provide, shallowRef } from "vue";
import type { InjectionKey, PropType, Ref, VNode } from "vue";
import { createTour } from "virtualtour";
import type { Tour, TourConfig, TourStep } from "virtualtour";

/** What {@link useTour} returns. `isRunning` and `currentStep` are readonly refs; the methods are stable. */
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

const watched = ["started", "step-shown", "finished", "exited", "deactivated"] as const;
const key: InjectionKey<UseTourResult> = Symbol("virtualtour-vue");

function wrapExitPrompt(config: TourConfig, gate: { bypass: boolean }): TourConfig {
  const prompt = config.exitPrompt;
  if (prompt === undefined || prompt === false) return config;
  return {
    ...config,
    exitPrompt: async () => {
      if (gate.bypass) return true;
      return typeof prompt === "string" ? window.confirm(prompt) : prompt();
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
    const gate = { bypass: false };
    const tour = createTour(wrapExitPrompt(props.config, gate));
    const running = shallowRef(false);
    const step = shallowRef<TourStep | null>(null);
    let disposed = false;
    let offs: Array<() => void> = [];

    const sync = (): void => {
      running.value = tour.isRunning();
      step.value = tour.currentStep;
    };

    const exitWithoutPrompt = (): void => {
      if (!tour.isRunning()) return;
      gate.bypass = true;
      void tour.exit().finally(() => {
        gate.bypass = false;
      });
    };

    tour.on("started", () => {
      queueMicrotask(() => {
        if (disposed) exitWithoutPrompt();
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
      offs = watched.map((event) => tour.on(event, sync));
      sync();
      if (props.autoStart && !tour.isRunning()) {
        value.start().catch((error: unknown) => {
          console.error("[virtualtour-vue] autoStart failed:", error);
        });
      }
    });

    onBeforeUnmount(() => {
      disposed = true;
      offs.forEach((off) => off());
      offs = [];
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
