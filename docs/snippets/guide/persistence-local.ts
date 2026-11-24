import { createTour, localStorageStore } from "virtual-site-tour";

export const tour = createTour({
  id: "onboarding-v1",
  progress: { store: localStorageStore("my-app") },
  steps: [
    { id: "welcome", title: "Welcome" },
    { id: "projects", target: "#projects", title: "Projects" },
    { id: "invite", target: "#invite", title: "Invite your team" },
  ],
});

export async function startOnce(): Promise<void> {
  tour.on("bypassed", () => console.log("Already completed, nothing shown."));
  await tour.start();
}
