import { createTour } from "../../packages/core/src/index";
import type { StepConfig, Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
    vtTimes: Record<string, number>;
  }
}

const mode = new URLSearchParams(location.search).get("mode");

const gated: StepConfig =
  mode === "buttons"
    ? {
        id: "save",
        title: "Save",
        body: "Click Save, then use the button below.",
        target: "#save",
        instruction: "Click Save.",
        autoAdvance: { event: "click" },
        buttons: [{ text: "Continue", action: "forward" }],
      }
    : mode === "selector"
      ? {
          id: "save",
          title: "Save",
          body: "Click Other to finish this step.",
          target: "#save",
          instruction: "Click Other.",
          advanceDelay: 300,
          autoAdvance: { event: "click", selector: "#other" },
        }
      : {
          id: "save",
          title: "Save",
          body: "Click the real button.",
          target: "#save",
          instruction: "Click Save.",
          advanceDelay: 600,
          autoAdvance: { event: "click" },
        };

const tour = createTour({
  name: "action-steps",
  animate: false,
  dim: false,
  steps: [gated, { id: "after", title: "After", body: "You did it." }],
});

window.vtTour = tour;
window.vtLog = [];
window.vtTimes = {};
tour.on("step-shown", (p) => {
  window.vtLog.push(`shown:${p.step.id}`);
  window.vtTimes[`shown:${p.step.id}`] = performance.now();
});
tour.on("step-completed", (p) => {
  window.vtLog.push(`completed:${p.step.id}`);
  window.vtTimes[`completed:${p.step.id}`] = performance.now();
  queueMicrotask(() => {
    if (document.querySelector(".vt-popover-instruction-done")) window.vtLog.push(`done-state:${p.step.id}`);
  });
});
tour.on("finished", () => window.vtLog.push("finished"));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});

document.documentElement.dataset.ready = "true";
