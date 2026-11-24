import { createTour, memoryStore, parseTourJson } from "virtual-site-tour";

export function withCodeOnlyKeys(documentText: string) {
  const config = parseTourJson(documentText);
  return createTour({
    ...config,
    progress: { store: memoryStore() },
    sanitize: (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ""),
  });
}
