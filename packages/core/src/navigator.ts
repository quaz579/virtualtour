import { TourNavigationError } from "./errors";
import type { TourStep } from "./step";

/** What a navigation request resolves to. */
export type NavigationOutcome =
  | { kind: "show"; index: number }
  | { kind: "finish" }
  | { kind: "exit" }
  | { kind: "stay" };

/**
 * Picks the step to show when moving from `from` (`-1` before the first show). Forward past the last step finishes;
 * backward from the first step stays put; backward with nothing eligible before `from` exits.
 */
export function selectIndex(
  total: number,
  from: number,
  direction: "forward" | "backward",
  isEligible: (index: number) => boolean = () => true
): NavigationOutcome {
  if (direction === "forward") {
    for (let i = from + 1; i < total; i += 1) if (isEligible(i)) return { kind: "show", index: i };
    return { kind: "finish" };
  }
  if (from <= 0) return { kind: "stay" };
  for (let i = Math.min(from, total) - 1; i >= 0; i -= 1) if (isEligible(i)) return { kind: "show", index: i };
  return { kind: "exit" };
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
}

/**
 * Serializes navigation: one task runs at a time and at most one waits behind it. A newer request replaces the
 * waiting one, whose promise then resolves without running.
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
      const entry: Queued = { task, resolve, reject };
      if (this.running) {
        this.waiting?.resolve();
        this.waiting = entry;
        return;
      }
      void this.run(entry);
    });
  }

  /** Drops the waiting task; its promise resolves without running. */
  cancelWaiting(): void {
    this.waiting?.resolve();
    this.waiting = null;
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
      entry = this.waiting;
      this.waiting = null;
    }
    this.running = false;
  }
}
