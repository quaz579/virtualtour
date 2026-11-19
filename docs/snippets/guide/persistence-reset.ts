import { localStorageStore } from "virtualtour";

export async function resetTour(tourId: string): Promise<void> {
  await localStorageStore("my-app").clear(tourId);
}
