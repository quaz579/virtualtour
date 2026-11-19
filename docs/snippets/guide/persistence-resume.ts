import { createTour, localStorageStore } from "virtualtour";

export const tour = createTour({
  id: "onboarding-v2",
  progress: { store: localStorageStore(), resume: true, skipCompleted: true },
  steps: [
    { id: "welcome", title: "Welcome" },
    { id: "projects", target: "#projects", title: "Projects" },
    { id: "invite", target: "#invite", title: "Invite your team" },
  ],
});

export const replayable = createTour({
  id: "reference-tour",
  progress: { store: localStorageStore(), skipCompleted: false },
  steps: [{ id: "a", title: "Always shown" }],
});
