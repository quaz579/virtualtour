import "../../packages/core/src/styles/base.css";
import "../../packages/core/src/styles/theme.css";
import { createTour } from "../../packages/core/src/index";
import type { StepConfig, Tour, TourConfig } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
    vtBuild: (name: string) => Tour;
  }
}

const note = (): HTMLElement => {
  const element = document.createElement("p");
  element.id = "a11y-note";
  element.textContent = "Element body text";
  return element;
};

const steps: Record<string, StepConfig> = {
  titled: { id: "titled", target: "#t1", title: "Titled step", body: "Body text for the titled step." },
  untitled: { id: "untitled", target: "#t2", label: "Untitled labeled step", body: "Body text without a title." },
  centered: { id: "centered", title: "Centered step", body: "Nothing is highlighted here." },
  spotlit: {
    id: "spotlit",
    target: "#spot",
    title: "Spotlit step",
    body: "The paragraph and its control stay usable.",
    spotlight: { extra: ["#spot-extra"] },
  },
  action: {
    id: "action",
    target: "#t3",
    title: "Action step",
    body: "Press the highlighted button.",
    instruction: "Press Target three to continue.",
    autoAdvance: { event: "click" },
  },
  buttons: {
    id: "buttons",
    target: "#t1",
    title: "Custom buttons",
    body: note(),
    buttons: [
      { text: "Secondary", kind: "secondary", action: () => window.vtLog.push("secondary") },
      { text: "Move on", action: "forward" },
    ],
  },
  elementBody: { id: "element-body", target: "#t1", title: "Element body", body: note() },
};

const tours: Record<string, TourConfig> = {
  titled: { name: "a11y-titled", steps: [steps["titled"]!] },
  untitled: { name: "a11y-untitled", steps: [steps["untitled"]!] },
  centered: { name: "a11y-centered", steps: [steps["centered"]!] },
  spotlit: { name: "a11y-spotlit", steps: [steps["spotlit"]!] },
  action: { name: "a11y-action", steps: [steps["action"]!] },
  buttons: { name: "a11y-buttons", steps: [steps["buttons"]!, { id: "after", title: "After", body: "Done." }] },
  element: { name: "a11y-element", steps: [steps["elementBody"]!] },
  four: {
    name: "a11y-four",
    counter: true,
    steps: [
      { id: "s1", target: "#t1", title: "First", body: "One of four." },
      { id: "s2", target: "#t2", title: "Second", body: "Two of four." },
      { id: "s3", target: "#field", title: "Third", body: "Three of four." },
      { id: "s4", title: "Fourth", body: "Four of four." },
    ],
  },
  keysOff: {
    name: "a11y-keys-off",
    keys: { escape: false, arrows: false },
    steps: [
      { id: "k1", target: "#t1", title: "Keys one", body: "First." },
      { id: "k2", target: "#t2", title: "Keys two", body: "Second." },
    ],
  },
  motion: {
    name: "a11y-motion",
    steps: [
      { id: "m1", target: "#t1", title: "Motion one", body: "First." },
      { id: "m2", target: "#t2", title: "Motion two", body: "Second." },
    ],
  },
};

const theme = new URLSearchParams(location.search).get("theme");
if (theme) document.documentElement.dataset["vtTheme"] = theme;

window.vtLog = [];
window.vtBuild = (name) => {
  const config = tours[name];
  if (!config) throw new Error(`unknown tour ${name}`);
  const tour = createTour({ animate: false, ...config, ...(name === "motion" ? { animate: true } : {}) });
  tour.on("step-shown", (event) => window.vtLog.push(`shown:${event.step.id}`));
  tour.on("deactivated", () => window.vtLog.push("deactivated"));
  window.vtTour = tour;
  return tour;
};

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  const name = new URLSearchParams(location.search).get("tour") ?? "titled";
  void window.vtBuild(name).start();
});

document.documentElement.dataset.ready = "true";
