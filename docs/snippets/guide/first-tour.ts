import "virtualtour/base.css";
import { createTour } from "virtualtour";

export const tour = createTour({
  name: "welcome",
  dim: true,
  steps: [
    {
      id: "save",
      target: "#save",
      placement: { side: "bottom", align: "start" },
      title: "Save your work",
      body: "Changes are kept in this browser until you press Save.",
    },
    {
      id: "done",
      title: "That is all",
      body: "Press Done to close the tour.",
    },
  ],
});

document.querySelector("#start-tour")?.addEventListener("click", () => {
  void tour.start();
});
