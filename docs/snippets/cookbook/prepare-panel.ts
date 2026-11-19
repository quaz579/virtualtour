import { createTour } from "virtualtour";

export function panelTour(openPanel: () => void) {
  return createTour({
    steps: [
      { id: "open", title: "Open the panel", prepare: openPanel },
      { id: "panel", title: "The panel", target: "#panel-button" },
    ],
  });
}
