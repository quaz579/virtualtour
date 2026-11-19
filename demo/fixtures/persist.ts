import { createTour, localStorageStore } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
  }
}

const params = new URLSearchParams(location.search);

const tour = createTour({
  id: "persist-demo",
  animate: false,
  progress: {
    store: localStorageStore(),
    resume: params.get("resume") === "1",
    skipCompleted: params.get("skipCompleted") !== "0",
  },
  steps: [
    { id: "one", title: "One", body: "First.", target: "#one" },
    { id: "two", title: "Two", body: "Second.", target: "#two" },
    { id: "three", title: "Three", body: "Third.", target: "#three" },
  ],
});

window.vtTour = tour;
window.vtLog = [];
tour.on("started", () => window.vtLog.push("started"));
tour.on("bypassed", (p) => window.vtLog.push(`bypassed:${p.reason}`));
tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));
tour.on("finished", () => window.vtLog.push("finished"));
tour.on("exited", (p) => window.vtLog.push(`exited:${p.reason}`));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});

document.documentElement.dataset.ready = "true";
