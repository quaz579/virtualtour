import { createTour } from "virtual-site-tour";

export const tour = createTour({
  id: "offset",
  steps: [
    { id: "gap", target: "#a", title: "Wider gap", placement: { side: "bottom" }, position: { offset: 24 } },
    {
      id: "slide",
      target: "#b",
      title: "Gap and slide",
      placement: { side: "bottom", align: "start" },
      position: { offset: { main: 12, cross: 20 } },
    },
    {
      id: "vertical",
      target: "#c",
      title: "Down the edge",
      placement: { side: "right", align: "start" },
      position: { offset: { cross: -8 } },
    },
  ],
});
