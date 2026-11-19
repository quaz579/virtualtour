import { Emitter, localStorageStore, memoryStore, parseTourJson, serializeTour, TourJsonError, createTour } from "virtualtour";
import type { TourEvents } from "virtualtour";

export function helpers(json: string) {
  try {
    const config = parseTourJson(json, { handlers: { openMenu: () => undefined } });
    const tour = createTour({ ...config, progress: { store: memoryStore() } });
    const document = serializeTour({ steps: [{ title: "Hello" }] });
    return { tour, document, persistent: localStorageStore("my-app") };
  } catch (error) {
    if (error instanceof TourJsonError) console.error(error.path);
    throw error;
  }
}

export const bus = new Emitter<TourEvents>();
