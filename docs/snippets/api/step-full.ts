import { createTour } from "virtual-site-tour";
import type { StepConfig } from "virtual-site-tour";

export const step: StepConfig = {
  id: "save",
  title: "Save your work",
  body: ["Press <b>Save</b>.", "Changes are kept for 30 days."],
  label: "Save step",
  closeButton: { label: "Skip" },
  classes: ["wide"],
  meta: { area: "editor" },
  target: "#save",
  placement: { side: "auto", align: "start" },
  position: { offset: { main: 12, cross: 4 }, boundary: "viewport", flip: true, shift: true, strategy: "fixed", arrow: { minInset: 12 } },
  waitFor: 2000,
  whenMissing: "skip",
  shouldShow: () => document.body.dataset["role"] !== "viewer",
  prepare: () => undefined,
  hookTimeout: 5000,
  spotlight: { padding: 6, radius: 4, extra: ["#save-menu"], class: "lit", targetInteractive: "hover-only" },
  reveal: "smooth",
  autoAdvance: { event: "click", selector: "#save" },
  instruction: "Click <b>Save</b>.",
  advanceDelay: 500,
  focus: "first-button",
  extensions: { avatar: { idle: true } },
};

export const tour = createTour({ steps: [step] });
