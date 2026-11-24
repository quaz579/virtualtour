import { createTour } from "virtual-site-tour";

export const tour = createTour({
  id: "focus",
  steps: [
    { id: "default", title: "Focus lands on Next" },
    {
      id: "choice",
      title: "Focus lands on Yes",
      body: "Open the settings panel?",
      focus: "first-button",
      buttons: [
        { text: "Yes", action: "forward" },
        { text: "No", action: "exit", kind: "secondary" },
      ],
    },
    { id: "form", target: "#name", title: "Typing keeps focus", spotlight: { targetInteractive: true } },
  ],
});
