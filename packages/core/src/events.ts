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
