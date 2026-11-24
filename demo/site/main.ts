import { scenarios } from "../scenarios";
import type { Tour } from "../../packages/core/src/index";
import "../../packages/core/src/styles/base.css";
import "../../packages/core/src/styles/theme.css";
import "../../packages/core/src/styles/avatar.css";
import "./styles.css";

declare global {
  interface Window {
    vtSite: { run(id: string): Promise<void>; stop(): void; tour?: Tour; errors: string[] };
  }
}

const grid = document.querySelector<HTMLElement>("#scenario-grid");
const status = document.querySelector<HTMLElement>("#tour-status");
const root = document.documentElement;
const state: Window["vtSite"] = {
  errors: [],
  stop() {
    state.tour?.finish();
    delete state.tour;
  },
  async run(id) {
    const scenario = scenarios.find((item) => item.id === id);
    if (!scenario) throw new Error("Unknown tour: " + id);
    state.stop();
    const tour = scenario.build();
    state.tour = tour;
    document.querySelectorAll<HTMLButtonElement>("[data-tour-id]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset["tourId"] === id));
    });
    if (status) status.textContent = "Running: " + scenario.title;
    tour.on("deactivated", () => {
      document.querySelectorAll<HTMLButtonElement>("[data-tour-id]").forEach((button) => button.setAttribute("aria-pressed", "false"));
      if (status) status.textContent = "Select any card to start.";
      if (state.tour === tour) delete state.tour;
    });
    await tour.start();
  },
};

window.vtSite = state;
window.addEventListener("error", (event) => state.errors.push(event.message));
window.addEventListener("unhandledrejection", (event) => state.errors.push(String(event.reason)));

for (const [index, scenario] of scenarios.entries()) {
  const card = document.createElement("article");
  card.className = "scenario-card";
  const indexLabel = document.createElement("span");
  indexLabel.className = "scenario-index mono-label";
  indexLabel.textContent = String(index + 1).padStart(2, "0");
  const marker = document.createElement("span");
  marker.className = "scenario-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = "↗";
  const title = document.createElement("h4");
  title.textContent = scenario.title;
  const description = document.createElement("p");
  description.textContent = scenario.description;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "run-tour-button";
  button.dataset["tourId"] = scenario.id;
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", "Run " + scenario.title + " tour");
  button.innerHTML = "Run this tour <span aria-hidden=\"true\">→</span>";
  button.addEventListener("click", () => void state.run(scenario.id).catch((error: Error) => state.errors.push(error.message)));
  card.append(indexLabel, marker, title, description, button);
  grid?.append(card);
}

const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");
const themeLabel = document.querySelector<HTMLElement>("#theme-label");
function setTheme(value: "light" | "dark"): void {
  root.dataset["vtTheme"] = value;
  const next = value === "light" ? "dark" : "light";
  themeToggle?.setAttribute("aria-label", "Switch to " + next + " theme");
  if (themeLabel) themeLabel.textContent = next.charAt(0).toUpperCase() + next.slice(1) + " mode";
  state.tour?.refresh();
}
themeToggle?.addEventListener("click", () => setTheme(root.dataset["vtTheme"] === "dark" ? "light" : "dark"));

document.documentElement.dataset["ready"] = "true";
