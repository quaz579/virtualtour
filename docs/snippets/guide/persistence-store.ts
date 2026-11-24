import { createTour } from "virtual-site-tour";
import type { ProgressRecord, ProgressStore } from "virtual-site-tour";

export function serverStore(baseUrl: string): ProgressStore {
  return {
    async load(tourId) {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(tourId)}`);
      if (response.status === 404) return null;
      return (await response.json()) as ProgressRecord;
    },
    async save(record) {
      await fetch(`${baseUrl}/${encodeURIComponent(record.tourId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(record),
      });
    },
    async clear(tourId) {
      await fetch(`${baseUrl}/${encodeURIComponent(tourId)}`, { method: "DELETE" });
    },
  };
}

export const tour = createTour({
  id: "server-backed",
  progress: { store: serverStore("/api/tour-progress"), resume: true },
  steps: [
    { id: "one", title: "One" },
    { id: "two", title: "Two" },
  ],
});
