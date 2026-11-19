import type { ProgressRecord, ProgressStore } from "../types";

/** A store that keeps records in memory for the life of the page. Records are copied in and out. */
export function memoryStore(): ProgressStore {
  const records = new Map<string, ProgressRecord>();
  return {
    load: (tourId) => {
      const record = records.get(tourId);
      return record ? { ...record } : null;
    },
    save: (record) => {
      records.set(record.tourId, { ...record });
    },
    clear: (tourId) => {
      records.delete(tourId);
    },
  };
}
