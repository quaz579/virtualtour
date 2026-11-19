import { createTour } from "../../packages/core/src/index";
import type { StepConfig, Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
    vtWarnings: string[];
  }
}

const mode = new URLSearchParams(location.search).get("mode") ?? "gotcha";

const openPanel = (): void => {
  if (document.querySelector("#panel")) return;
  const panel = document.createElement("div");
  panel.id = "panel";
  panel.innerHTML = '<button id="panel-btn" type="button">Inside the panel</button>';
  document.querySelector("#panel-slot")?.appendChild(panel);
};

const steps: StepConfig[] =
  mode === "hang"
    ? [
        { id: "intro", title: "Intro", body: "First." },
        { id: "stuck", title: "Stuck", body: "Its prepare never settles.", hookTimeout: 400, prepare: () => new Promise<void>(() => {}) },
        { id: "after", title: "After", body: "Last." },
      ]
    : mode === "cookbook"
    ? [
        { id: "open", title: "Open", body: "Opens the panel while it prepares.", prepare: openPanel },
        { id: "panel", title: "Panel", body: "Attached to the panel button.", target: "#panel-btn" },
      ]
    : [
        { id: "intro", title: "Intro", body: "First." },
        { id: "panel", title: "Panel", body: "Prepared too late to attach.", target: "#panel-btn", prepare: openPanel },
      ];

const tour = createTour({ name: "prepare", animate: false, steps });

window.vtTour = tour;
window.vtLog = [];
tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));

window.vtWarnings = [];
const nativeWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  window.vtWarnings.push(args.map(String).join(" "));
  nativeWarn(...args);
};

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});

document.documentElement.dataset.ready = "true";
