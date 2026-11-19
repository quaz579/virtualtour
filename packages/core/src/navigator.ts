import { TourNavigationError } from "./errors";
import type { TourStep } from "./step";

/** What a navigation request resolves to. */
export type NavigationOutcome =
  | { kind: "show"; index: number }
  | { kind: "finish" }
  | { kind: "exit" }
  | { kind: "stay" };

/**
 * Picks the step to show when moving from `from` (`-1` before the first show). Candidates are tried one after another
 * in the direction of travel, and the eligibility check may be asynchronous. Forward past the last step finishes;
 * backward from the first step stays put; backward with nothing eligible before `from` exits. The outcome is returned
 * synchronously unless a check returned a promise.
 */
export function selectEligible(
  total: number,
  from: number,
  direction: "forward" | "backward",
  isEligible: (index: number) => boolean | Promise<boolean>
): NavigationOutcome | Promise<NavigationOutcome> {
  const forward = direction === "forward";
  if (!forward && from <= 0) return { kind: "stay" };
  const delta = forward ? 1 : -1;
  const scan = (first: number): NavigationOutcome | Promise<NavigationOutcome> => {
    for (let i = first; forward ? i < total : i >= 0; i += delta) {
      const verdict = isEligible(i);
      if (typeof verdict === "boolean") {
        if (verdict) return { kind: "show", index: i };
        continue;
      }
      return verdict.then((ok) => (ok ? { kind: "show", index: i } : scan(i + delta)));
    }
    return forward ? { kind: "finish" } : { kind: "exit" };
  };
  return scan(forward ? from + 1 : Math.min(from, total) - 1);
}

/** Applies `next` to a value that may still be a promise, staying synchronous when it is not. */
export function chain<T, R>(value: T | Promise<T>, next: (value: T) => R | Promise<R>): R | Promise<R> {
  return value instanceof Promise ? value.then(next) : next(value);
}

/** Resolves with `work`'s result, or `undefined` as soon as `signal` aborts; a failing `work` rejects. */
export function raceAbort<T>(work: Promise<T> | T, signal: AbortSignal | null): Promise<T | undefined> {
  if (!signal) return Promise.resolve(work);
  if (signal.aborted) return Promise.resolve(undefined);
  return new Promise<T | undefined>((resolve, reject) => {
    const onAbort = (): void => resolve(undefined);
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(work).then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

/** Resolves a step reference (index, id or instance) to an index; throws {@link TourNavigationError} when it matches none. */
export function resolveStepIndex(steps: readonly TourStep[], ref: string | number | TourStep): number {
  let index = -1;
  if (typeof ref === "number") index = Number.isInteger(ref) && ref >= 0 && ref < steps.length ? ref : -1;
  else if (typeof ref === "string") index = steps.findIndex((s) => s.id === ref);
  else index = steps.indexOf(ref);
  if (index < 0) {
    const label = typeof ref === "object" ? `step "${ref.id}"` : JSON.stringify(ref);
    throw new TourNavigationError(`[virtualtour] No step matches ${label}.`);
  }
  return index;
}

interface Queued {
  task: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
  followers: Array<() => void>;
}

/**
 * Serializes navigation: one task runs at a time and at most one waits behind it. A newer request replaces the
 * waiting one without running it; the replaced caller's promise resolves when the replacing task settles, so every
 * caller still observes the move that actually happened.
 */
export class NavigationQueue {
  private running = false;
  private waiting: Queued | null = null;

  /** Whether a task is running. */
  get busy(): boolean {
    return this.running;
  }

  /** Runs `task` now, or queues it behind the running task. */
  enqueue(task: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const entry: Queued = { task, resolve, reject, followers: [] };
      if (this.running) {
        const replaced = this.waiting;
        if (replaced) entry.followers.push(replaced.resolve, ...replaced.followers);
        this.waiting = entry;
        return;
      }
      void this.run(entry);
    });
  }

  /** Drops the waiting task; its promise resolves at once without running. */
  cancelWaiting(): void {
    const waiting = this.waiting;
    this.waiting = null;
    if (!waiting) return;
    waiting.resolve();
    for (const follower of waiting.followers) follower();
  }

  private async run(first: Queued): Promise<void> {
    this.running = true;
    let entry: Queued | null = first;
    while (entry) {
      try {
        await entry.task();
        entry.resolve();
      } catch (error) {
        entry.reject(error);
      }
      for (const follower of entry.followers) follower();
      entry = this.waiting;
      this.waiting = null;
    }
    this.running = false;
  }
}
