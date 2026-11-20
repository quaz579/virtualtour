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

  /** The stored record, or `null` when there is none, the store failed or `timeoutMs` passed. A late answer is ignored. Never rejects. */
  async load(timeoutMs = 0): Promise<ProgressRecord | null> {
    let loaded: unknown = null;
    if (this.pending) await this.pending;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const reading = Promise.resolve(this.config.store.load(this.tourId));
      if (timeoutMs > 0 && timeoutMs !== Infinity) {
        reading.catch(() => undefined);
        loaded = await Promise.race([
          reading,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              warn(`Progress store load for tour "${this.tourId}" did not settle within ${timeoutMs} ms; starting without saved progress.`);
              resolve(null);
            }, Math.min(timeoutMs, 2 ** 31 - 1));
          }),
        ]);
      } else loaded = await reading;
    } catch (error) {
      warn(`Progress store load failed for tour "${this.tourId}"; starting without saved progress.`, error);
    }
    clearTimeout(timer);
    this.record = cleanRecord(loaded, this.tourId);
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
    const fail = (error: unknown): void => warn(`Progress store save failed for tour "${this.tourId}".`, error);
    const run = (): void | Promise<void> => {
      try {
        const result = this.config.store.save(record);
        if (result) return Promise.resolve(result).catch(fail);
      } catch (error) {
        fail(error);
      }
    };
    const started = this.pending ? this.pending.then(run) : run();
    if (!started) return;
    const settled: Promise<void> = started.then(() => {
      if (this.pending === settled) this.pending = null;
    });
    this.pending = settled;
  }
}
