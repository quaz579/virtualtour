import { createTour } from "virtual-site-tour";

export function panelTour(openPanel: () => void) {
  return createTour({
    steps: [
      { id: "open", title: "Open the panel", prepare: openPanel },
      { id: "panel", title: "The panel", target: "#panel-button" },
    ],
  });
}
