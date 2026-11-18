import { Emitter } from "./events";
import type { TourEvents } from "./events";
import type { Tour } from "./tour";

const emitter = new Emitter<TourEvents>();

let current: Tour | null = null;

/** The one active tour and the relay of every tour event. */
export const tours: {
  readonly current: Tour | null;
  on<E extends keyof TourEvents>(e: E, fn: (payload: TourEvents[E]) => void, ctx?: object): () => void;
  once<E extends keyof TourEvents>(e: E, fn: (payload: TourEvents[E]) => void, ctx?: object): () => void;
  off<E extends keyof TourEvents>(e?: E, fn?: (payload: TourEvents[E]) => void): void;
} = {
  get current() {
    return current;
  },
  on: (e, fn, ctx) => emitter.on(e, fn, ctx),
  once: (e, fn, ctx) => emitter.once(e, fn, ctx),
  off: (e, fn) => emitter.off(e, fn),
};

/** Sets the active tour. Internal. */
export function setCurrentTour(tour: Tour | null): void {
  current = tour;
}

/** Relays a tour event to registry subscribers; the tour calls this after its own listeners ran. Internal. */
export function relayTourEvent<E extends keyof TourEvents>(e: E, payload: TourEvents[E]): void {
  emitter.emit(e, payload);
}
