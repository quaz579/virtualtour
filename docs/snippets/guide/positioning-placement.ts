import { createTour } from "virtualtour";

export const tour = createTour({
  id: "placement",
  steps: [
    { id: "a", target: "#a", title: "Below, start-aligned", placement: { side: "bottom", align: "start" } },
    { id: "b", target: "#b", title: "Right, centered", placement: { side: "right", align: "center" } },
    { id: "c", target: "#c", title: "Roomiest side", placement: "auto" },
    { id: "d", target: "#d", title: "Roomiest side, end-aligned", placement: { side: "auto", align: "end" } },
    { id: "e", target: "#e", title: "Highlight here, popover centered", placement: { side: "over" } },
    { id: "f", target: "#f", title: "Same as over", body: "A target with no placement behaves this way." },
  ],
});
