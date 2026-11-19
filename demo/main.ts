import { createTour } from "../packages/core/src/index";
import type { Tour } from "../packages/core/src/index";
import "../packages/core/src/styles/theme.css";
import "../packages/core/src/styles/avatar.css";
import sampleApp from "./sample-app.frag?raw";
import { scenarios } from "./scenarios";

declare global {
  interface Window {
    __createTour: typeof createTour;
    vtDemo: { scenarios: typeof scenarios; run(id: string): Promise<void>; stop(): void; tour?: Tour; errors: string[] };
  }
}

Object.assign(window, { __createTour: createTour });

const params = new URLSearchParams(location.search);
const root = document.documentElement;
const app = document.querySelector<HTMLElement>("#app");
const buttons = document.querySelector<HTMLElement>("#scenario-buttons");
const info = document.querySelector<HTMLElement>("#scenario-info");
const theme = document.querySelector<HTMLSelectElement>("#theme");
const dir = document.querySelector<HTMLSelectElement>("#dir");

if (app) app.innerHTML = sampleApp;

const state: Window["vtDemo"] = {
  scenarios,
  errors: [],
  stop() {
    state.tour?.finish();
    delete state.tour;
  },
  async run(id) {
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`unknown scenario ${id}`);
    state.stop();
    buttons?.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset["id"] === id)));
    if (info) info.textContent = scenario.description;
    const tour = scenario.build();
    state.tour = tour;
    await tour.start();
  },
};
window.vtDemo = state;

window.addEventListener("error", (event) => state.errors.push(event.message));
window.addEventListener("unhandledrejection", (event) => state.errors.push(String(event.reason)));

for (const scenario of scenarios) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset["id"] = scenario.id;
  button.setAttribute("aria-pressed", "false");
  button.textContent = scenario.title;
  button.addEventListener("click", () => void state.run(scenario.id).catch((error: Error) => state.errors.push(error.message)));
  buttons?.append(button);
}

function applyTheme(value: string): void {
  root.dataset["vtTheme"] = value === "dark" ? "dark" : "light";
  if (theme) theme.value = value === "dark" ? "dark" : "light";
}

function applyDir(value: string): void {
  root.dir = value === "rtl" ? "rtl" : "ltr";
  if (dir) dir.value = root.dir;
}

applyTheme(params.get("theme") ?? "light");
applyDir(params.get("dir") ?? "ltr");
theme?.addEventListener("change", () => applyTheme(theme.value));
dir?.addEventListener("change", () => applyDir(dir.value));

const initial = params.get("scenario");
if (initial) void state.run(initial).catch((error: Error) => state.errors.push(error.message));

root.dataset["ready"] = "true";
