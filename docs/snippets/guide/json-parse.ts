import { createTour, parseTourJson } from "virtualtour";

export async function startFromDocument(documentText: string, openSettingsPanel: () => void) {
  const tour = createTour(
    parseTourJson(documentText, {
      handlers: { confirmExit: () => confirm("Leave the tour?"), openSettings: () => openSettingsPanel() },
    }),
  );
  await tour.start();
  return tour;
}
