import type { Tour } from "./tour";
import type { TourStep } from "./step";

interface Listener {
  fn: (payload: never) => void;
  ctx: object | undefined;
  once: boolean;
  active: boolean;
}

/** Typed event emitter. Handlers run in registration order; a throwing handler is reported and the rest still run. */
export class Emitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Listener[]>();

  /** Subscribes `fn`; returns a function that removes this subscription. `ctx` becomes `this` inside `fn`. */
  on<E extends keyof Events>(e: E, fn: (payload: Events[E]) => void, ctx?: object): () => void {
    return this.add(e, fn, ctx, false);
  }

  /** Like {@link Emitter.on}, but the handler is removed before its first call. */
  once<E extends keyof Events>(e: E, fn: (payload: Events[E]) => void, ctx?: object): () => void {
    return this.add(e, fn, ctx, true);
  }

  /** Removes every handler, every handler of one event, or every registration of one handler for one event. */
  off<E extends keyof Events>(e?: E, fn?: (payload: Events[E]) => void): void {
    if (e === undefined) {
      if (fn !== undefined) return;
      for (const list of this.listeners.values()) for (const l of list) l.active = false;
      this.listeners.clear();
      return;
    }
    const list = this.listeners.get(e);
    if (!list) return;
    const keep: Listener[] = [];
    for (const l of list) {
      if (fn === undefined || l.fn === fn) l.active = false;
      else keep.push(l);
    }
    if (keep.length) this.listeners.set(e, keep);
    else this.listeners.delete(e);
  }

  /** Calls the handlers of `e` with `payload`. Internal. */
  emit<E extends keyof Events>(e: E, payload: Events[E]): void {
    const list = this.listeners.get(e);
    if (!list) return;
    for (const l of list.slice()) {
      if (!l.active) continue;
      if (l.once) this.remove(e, l);
      try {
        (l.fn as (payload: Events[E]) => void).call(l.ctx, payload);
      } catch (error) {
        console.error(`[virtualtour] Handler for "${String(e)}" threw:`, error);
      }
    }
  }

  private add<E extends keyof Events>(
    e: E,
    fn: (payload: Events[E]) => void,
    ctx: object | undefined,
    once: boolean
  ): () => void {
    const listener: Listener = { fn: fn as (payload: never) => void, ctx, once, active: true };
    const list = this.listeners.get(e);
    if (list) list.push(listener);
    else this.listeners.set(e, [listener]);
    return () => this.remove(e, listener);
  }

  private remove(e: keyof Events, listener: Listener): void {
    listener.active = false;
    const list = this.listeners.get(e);
    if (!list) return;
    const next = list.filter((l) => l !== listener);
    if (next.length) this.listeners.set(e, next);
    else this.listeners.delete(e);
  }
}

/** Why a tour ended without finishing. */
export type ExitReason = "close" | "escape" | "overlay" | "api" | "replaced";

/** Tour-level events; the registry relays every one of them. */
export interface TourEvents {
  started: { tour: Tour };
  activated: { tour: Tour };
  deactivated: { tour: Tour };
  "step-shown": { tour: Tour; step: TourStep; previous: TourStep | null };
  /** An action step's instruction was met. */
  "step-completed": { tour: Tour; step: TourStep };
  /**
   * `appendStep` or `dropStep` changed the step list. Fires after the list and the progress text are updated. When the
   * step on screen was dropped from a running tour it fires before the next step is chosen, so `currentStep` is null.
   */
  "steps-changed": { tour: Tour };
  finished: { tour: Tour };
  exited: { tour: Tour; reason: ExitReason };
  bypassed: { tour: Tour; reason: "completed" };
}

/** Step-level events. */
export interface StepEvents {
  "will-show": { step: TourStep };
  shown: { step: TourStep };
  "will-hide": { step: TourStep };
  hidden: { step: TourStep };
  /** An action step's instruction was met. */
  completed: { step: TourStep };
  finished: { step: TourStep };
  exited: { step: TourStep };
  disposed: { step: TourStep };
}
