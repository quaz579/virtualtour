import { createTour, tours } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
  }
}

const mode = new URLSearchParams(location.search).get("mode");
const createMode = mode === "create";
const doubleMode = mode === "double";

const tour = createTour({
  name: "auto-advance",
  animate: false,
  dim: false,
  steps: doubleMode
    ? [
        { id: "save", title: "Save", body: "Click Save.", target: "#save", autoAdvance: { event: "click", selector: "#save" } },
        { id: "slow", title: "Slow", body: "Prepares slowly.", prepare: () => new Promise<void>((resolve) => setTimeout(resolve, 300)) },
        { id: "third", title: "Third", body: "Must not be reached by one click." },
      ]
    : createMode
    ? [
        { id: "save", title: "Save", body: "Click Save.", target: "#save", autoAdvance: { event: "click", selector: "#save" } },
        { id: "created", title: "Created", body: "Points at what Save made.", target: "#created" },
      ]
    : [
    { id: "save", title: "Save", body: "Click Save.", target: "#save", autoAdvance: { event: "click", selector: "#save" } },
    { id: "name", title: "Name", body: "Type a name.", target: "#name", autoAdvance: { event: "input" } },
    { id: "page", title: "Page", body: "The page moves the tour." },
    { id: "end", title: "End", body: "Done." },
  ],
});

window.vtTour = tour;
window.vtLog = [];
tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));
tour.on("finished", () => window.vtLog.push("finished"));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});
document.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", () => {
  window.vtLog.push("save-clicked");
  if (doubleMode) void tours.current?.forward();
  if (!createMode || document.querySelector("#created")) return;
  const created = document.createElement("p");
  created.id = "created";
  created.textContent = "Saved";
  document.body.appendChild(created);
});
document.querySelector<HTMLButtonElement>("#page-forward")?.addEventListener("click", () => {
  void tours.current?.forward();
});

document.documentElement.dataset.ready = "true";
