import { createTour } from "virtual-site-tour";
import type { ExitReason } from "virtual-site-tour";

export const tour = createTour({
  id: "exit-reasons",
  exitPrompt: () => Promise.resolve(window.confirm("Leave the tour?")),
  steps: [{ id: "a", title: "A" }],
});

export function describe(reason: ExitReason): string {
  switch (reason) {
    case "close":
      return "The user pressed the close button.";
    case "escape":
      return "The user pressed Escape.";
    case "overlay":
      return "The user clicked the dimmed area with dim.clickOutside set to exit.";
    case "api":
      return "Code called exit(), a step was dropped with none left, or navigation failed.";
    case "replaced":
      return "Another tour started.";
  }
}

tour.on("exited", ({ reason }) => console.log(describe(reason)));
