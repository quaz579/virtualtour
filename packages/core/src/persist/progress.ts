import type { ProgressConfig, ProgressRecord } from "../types";

declare const __DEV__: boolean | undefined;

function warn(message: string, error?: unknown): void {
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;
  if (error === undefined) console.warn(`[virtualtour] ${message}`);
  else console.warn(`[virtualtour] ${message}`, error);
}

function cleanRecord(value: unknown, tourId: string): ProgressRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  if (data["tourId"] !== tourId || typeof data["updatedAt"] !== "string") return null;
  const record: ProgressRecord = { tourId, updatedAt: data["updatedAt"] };
  for (const key of ["lastStepId", "completedAt", "exitedAt"] as const) {
    const field = data[key];
    if (typeof field === "string") record[key] = field;
  }
  return record;
}

const MAX_TIMER_MS = 2 ** 31 - 1;

function isBounded(ms: number): boolean {
  return ms > 0 && ms !== Infinity;
}

/** Reads and writes one tour's progress through its store. Internal. */
export class ProgressTracker {
  private record: ProgressRecord | null = null;
  private pending: Promise<void> | null = null;
  private loadSeq = 0;

  constructor(
    private readonly tourId: string,
    private readonly config: ProgressConfig,
    private readonly budgetMs = 0
  ) {}

  get skipCompleted(): boolean {
    return this.config.skipCompleted !== false;
  }

  get resume(): boolean {
    return this.config.resume === true;
  }

  /**
   * The stored record, or `null` when there is none, the store failed or `timeoutMs` passed, counting any wait for
   * pending saves. A late answer is ignored except that its `completedAt` is kept and saved so later saves do not
   * erase it, and only when no newer `load()` has started. Never rejects.
   */
  async load(timeoutMs = 0): Promise<ProgressRecord | null> {
    const seq = ++this.loadSeq;
    let loaded: unknown = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let savingFirst = false;
    const reading = (async (): Promise<unknown> => {
      if (this.pending) {
        savingFirst = true;
        await this.pending;
        savingFirst = false;
      }
      return this.config.store.load(this.tourId);
    })();
    try {
      if (isBounded(timeoutMs)) {
        loaded = await Promise.race([
          reading,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              timedOut = true;
              warn(
                `Progress store ${savingFirst ? "save" : "load"} for tour "${this.tourId}" did not settle within ${timeoutMs} ms; starting without saved progress.`
              );
              resolve(null);
            }, Math.min(timeoutMs, MAX_TIMER_MS));
          }),
        ]);
      } else loaded = await reading;
    } catch (error) {
      warn(`Progress store load failed for tour "${this.tourId}"; starting without saved progress.`, error);
    }
    clearTimeout(timer);
    this.record = cleanRecord(loaded, this.tourId);
    if (timedOut) {
      reading.then(
        (late) => {
          if (seq !== this.loadSeq) return;
          const completedAt = cleanRecord(late, this.tourId)?.completedAt;
          if (completedAt === undefined || this.record?.completedAt !== undefined) return;
          this.write({ ...(this.record ?? { tourId: this.tourId, updatedAt: new Date().toISOString() }), completedAt });
        },
        () => undefined
      );
    }
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

  private bounded(running: void | Promise<void>): void | Promise<void> {
    if (!running || !isBounded(this.budgetMs)) return running;
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        warn(`A progress store save for tour "${this.tourId}" did not settle within ${this.budgetMs} ms; later saves continue without waiting for it.`);
        resolve();
      }, Math.min(this.budgetMs, MAX_TIMER_MS));
      running.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private write(record: ProgressRecord): void {
    this.record = record;
    const fail = (error: unknown): void => warn(`Progress store save failed for tour "${this.tourId}".`, error);
    const run = (): void | Promise<void> => {
      try {
        const result = this.config.store.save(record);
        if (result) return Promise.resolve(result).catch(fail);
      } catch (error) {
        fail(error);
      }
    };
    const started = this.pending ? this.pending.then(() => this.bounded(run())) : this.bounded(run());
    if (!started) return;
    const settled: Promise<void> = started.then(() => {
      if (this.pending === settled) this.pending = null;
    });
    this.pending = settled;
  }
}
