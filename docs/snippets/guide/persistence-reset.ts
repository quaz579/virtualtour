import { localStorageStore } from "virtual-site-tour";

export async function resetTour(tourId: string): Promise<void> {
  await localStorageStore("my-app").clear(tourId);
}
