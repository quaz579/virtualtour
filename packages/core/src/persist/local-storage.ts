import type { ProgressRecord, ProgressStore } from "../types";

const DEFAULT_PREFIX = "virtualtour";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parseRecord(raw: string | null, tourId: string): ProgressRecord | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data["tourId"] !== tourId || typeof data["updatedAt"] !== "string") return null;
  const record: ProgressRecord = { tourId, updatedAt: data["updatedAt"] };
  for (const key of ["lastStepId", "completedAt", "exitedAt"] as const) {
    const field = data[key];
    if (typeof field === "string") record[key] = field;
  }
  return record;
}

/**
 * A store backed by `window.localStorage`, keyed `<prefix>:<tourId>` (default prefix `virtualtour`) with a JSON value.
 * Storage is read only when a method runs, never at import. Unavailable storage, a full quota and corrupt or
 * foreign values never throw: `load` returns `null` and `save` and `clear` do nothing.
 */
export function localStorageStore(prefix: string = DEFAULT_PREFIX): ProgressStore {
  const keyOf = (tourId: string): string => `${prefix}:${tourId}`;
  return {
    load(tourId) {
      try {
        return parseRecord(storage()?.getItem(keyOf(tourId)) ?? null, tourId);
      } catch {
        return null;
      }
    },
    save(record) {
      try {
        storage()?.setItem(keyOf(record.tourId), JSON.stringify(record));
      } catch {}
    },
    clear(tourId) {
      try {
        storage()?.removeItem(keyOf(tourId));
      } catch {}
    },
  };
}
