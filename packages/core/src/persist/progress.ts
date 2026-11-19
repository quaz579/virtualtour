import type { ProgressConfig, ProgressRecord } from "../types";

declare const __DEV__: boolean | undefined;

function warn(message: string, error?: unknown): void {
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;
  if (error === undefined) console.warn(`[virtualtour] ${message}`);
  else console.warn(`[virtualtour] ${message}`, error);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

function isRecord(value: unknown, tourId: string): value is ProgressRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<ProgressRecord>;
  return record.tourId === tourId && typeof record.updatedAt === "string";
}

/** Reads and writes one tour's progress through its store. Internal. */
export class ProgressTracker {
  private record: ProgressRecord | null = null;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly tourId: string,
    private readonly config: ProgressConfig
  ) {}

  get skipCompleted(): boolean {
    return this.config.skipCompleted !== false;
  }

  get resume(): boolean {
    return this.config.resume === true;
  }

  /** The stored record, or `null` when there is none or the store failed. Never rejects. */
  async load(): Promise<ProgressRecord | null> {
    let loaded: unknown = null;
    try {
      loaded = await this.config.store.load(this.tourId);
    } catch (error) {
      warn(`Progress store load failed for tour "${this.tourId}"; starting without saved progress.`, error);
    }
    this.record = isRecord(loaded, this.tourId) ? loaded : null;
    return this.record;
  }

  stepShown(stepId: string): void {
    const previous = this.record;
    const now = new Date().toISOString();
    const next: ProgressRecord = { tourId: this.tourId, lastStepId: stepId, updatedAt: now };
    if (previous?.completedAt !== undefined) next.completedAt = previous.completedAt;
    this.write(next);
  }

  finished(): void {
    const now = new Date().toISOString();
    this.write({ tourId: this.tourId, completedAt: now, updatedAt: now });
  }

  exited(stepId: string | undefined): void {
    const previous = this.record;
    const now = new Date().toISOString();
    const next: ProgressRecord = { tourId: this.tourId, exitedAt: now, updatedAt: now };
    const lastStepId = stepId ?? previous?.lastStepId;
    if (lastStepId !== undefined) next.lastStepId = lastStepId;
    if (previous?.completedAt !== undefined) next.completedAt = previous.completedAt;
    this.write(next);
  }

  private write(record: ProgressRecord): void {
    this.record = record;
    const run = (): Promise<void> | undefined => {
      try {
        const result = this.config.store.save(record);
        if (isThenable(result)) return Promise.resolve(result).then(undefined, (error: unknown) => warn(`Progress store save failed for tour "${this.tourId}".`, error));
      } catch (error) {
        warn(`Progress store save failed for tour "${this.tourId}".`, error);
      }
      return undefined;
    };
    const queued = this.pending ? this.pending.then(run) : run();
    if (!queued) return;
    const settled: Promise<void> = queued.then(() => {
      if (this.pending === settled) this.pending = null;
    });
    this.pending = settled;
  }
}
