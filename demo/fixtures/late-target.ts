import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
    vtMarks: Record<string, number>;
  }
}

const params = new URLSearchParams(location.search);
const delay = Number(params.get("delay") ?? 800);
const waitFor = Number(params.get("waitFor") ?? 3000);
const never = params.get("never") === "1";
const skip = params.get("skip") === "1";

const tour = createTour({
  name: "late-target",
  animate: false,
  steps: [
    {
      id: "late",
      title: "Late",
      body: "Waits for its target.",
      target: "#late-target",
      waitFor,
      ...(skip ? { whenMissing: "skip" as const } : {}),
    },
    { id: "end", title: "End", body: "Last step." },
  ],
});

window.vtTour = tour;
window.vtLog = [];
window.vtMarks = {};
tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));
tour.on("finished", () => window.vtLog.push("finished"));
tour.on("exited", (p) => window.vtLog.push(`exited:${p.reason}`));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  window.vtMarks["clicked"] = performance.now();
  if (!never) {
    setTimeout(() => {
      const el = document.createElement("button");
      el.id = "late-target";
      el.type = "button";
      el.textContent = "Late button";
      document.querySelector("#slot")?.appendChild(el);
      window.vtMarks["attached"] = performance.now();
    }, delay);
  }
  void tour.start().then(() => {
    window.vtMarks["started"] = performance.now();
    window.vtLog.push(`started:${document.querySelector("#late-target") ? "attached" : "absent"}`);
  });
});

document.documentElement.dataset.ready = "true";
