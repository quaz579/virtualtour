import { createTour, parseTourJson } from "../packages/core/src/index";
import type { Tour, TourConfig } from "../packages/core/src/index";
import { loadClassicAvatarPack, thumbtackPack, withAvatar } from "../packages/core/src/avatar/index";
import { glide, progressVars } from "../packages/core/src/motion";
import classicAvatarMapUrl from "../packages/core/e2e/fixtures/test-pack/classic-a.json?url";
import classicAvatarSheetUrl from "../packages/core/e2e/fixtures/test-pack/sheet.png?url";
import showcaseJson from "./tours/showcase.tour.json?raw";

export interface Scenario {
  id: string;
  title: string;
  description: string;
  build(): Tour;
}

const testPack = (name: "classic-a.json" | "sheet.png"): string => (name === "sheet.png" ? classicAvatarSheetUrl : classicAvatarMapUrl);

function core(): TourConfig {
  return {
    name: "core",
    dim: true,
    counter: true,
    steps: [
      { id: "welcome", title: "Welcome", body: ["A tour is a list of steps.", "A step without a target sits in the middle."] },
      { id: "search", title: "Search", body: "A step points at an element by selector.", target: "#search", placement: { side: "bottom", align: "start" } },
      { id: "revenue", title: "Revenue", body: "The popover follows the target.", target: "#card-a", placement: { side: "bottom" } },
      { id: "done", title: "That is it", body: "Close the tour or go back." },
    ],
  };
}

function placement(): TourConfig {
  return {
    name: "placement",
    counter: true,
    steps: [
      { id: "right", title: "Right", body: "side: right", target: "#side-inbox", placement: { side: "right" } },
      { id: "bottom-end", title: "Bottom, end", body: "side: bottom, align: end", target: "#card-b", placement: { side: "bottom", align: "end" } },
      { id: "top", title: "Top", body: "side: top", target: "#form", placement: { side: "top" } },
      { id: "flip", title: "Flips to fit", body: "Asked for right, but the profile button is at the edge: the popover flips.", target: "#profile", placement: { side: "right" } },
      { id: "auto", title: "Auto", body: "side: auto picks the roomiest side.", target: "#footer-note", placement: "auto" },
      { id: "no-arrow", title: "No arrow", body: "arrow: false", target: "#card-c", placement: { side: "bottom" }, position: { arrow: false } },
    ],
  };
}

function spotlight(): TourConfig {
  return {
    name: "spotlight",
    dim: { padding: 8, radius: 8, opacity: 0.75 },
    counter: true,
    steps: [
      { id: "tight", title: "Tight cut-out", body: "Default padding and radius.", target: "#card-a" },
      { id: "round", title: "Rounded", body: "Per-step radius and padding.", target: "#card-b", spotlight: { padding: 16, radius: 24 } },
      { id: "extra", title: "Extra cut-outs", body: "Two elements stay lit together.", target: "#card-a", spotlight: { extra: ["#card-c"] } },
      { id: "locked", title: "Look, don't touch", body: "The target is not interactive here.", target: "#save", spotlight: { targetInteractive: false } },
    ],
  };
}

function action(): TourConfig {
  return {
    name: "action",
    dim: true,
    steps: [
      { id: "type", title: "Type a name", body: "The tour waits for you.", target: "#customer", instruction: "Click the customer field.", autoAdvance: { event: "focus" }, advanceDelay: 300 },
      { id: "save", title: "Save", body: "Click the real button to move on.", target: "#save", instruction: "Click Save invoice.", autoAdvance: { event: "click" }, advanceDelay: 300 },
      { id: "after", title: "All done", body: "Action steps complete when you do the work." },
    ],
  };
}

function json(): TourConfig {
  return parseTourJson(showcaseJson);
}

function motion(): Tour {
  const tour = createTour({
    name: "motion",
    animate: true,
    counter: (index, total) => `Step ${index} of ${total}`,
    steps: [
      { id: "one", title: "Glide", body: "The popover glides between targets.", target: "#nav-home", placement: { side: "bottom" } },
      { id: "two", title: "Two", body: "No jump cut.", target: "#card-b", placement: { side: "right" } },
      { id: "three", title: "Three", body: "Progress variables update too.", target: "#save", placement: { side: "top" } },
    ],
  });
  const stopGlide = glide(tour, { durationMs: 450 });
  const stopProgress = progressVars(tour);
  tour.on("step-shown", ({ step }) => step.element?.setAttribute("data-vt-progress-bar", ""));
  tour.on("deactivated", () => {
    stopGlide();
    stopProgress();
  });
  return tour;
}

const avatarSteps: TourConfig["steps"] = [
  { id: "hello", title: "Hi there", body: "I am your guide." },
  { id: "search", title: "Search", body: "Look over here.", target: "#search", placement: { side: "right", align: "end" } },
  { id: "cards", title: "Cards", body: "Numbers live here.", target: "#card-b", placement: { side: "bottom" }, extensions: { avatar: { animation: "think" } } },
  { id: "bye", title: "Done", body: "Thanks for following along." },
];

export const scenarios: Scenario[] = [
  { id: "core", title: "Core tour", description: "Four steps: a centered step, two targeted steps, a closing step.", build: () => createTour(core()) },
  { id: "placement", title: "Placement", description: "Sides, alignment, auto, flipping and arrow control.", build: () => createTour(placement()) },
  { id: "spotlight", title: "Spotlight", description: "Dimmed page with per-step padding, radius, extra cut-outs and a locked target.", build: () => createTour(spotlight()) },
  { id: "action", title: "Action steps", description: "Steps that wait for you to focus a field and click Save.", build: () => createTour(action()) },
  { id: "json", title: "JSON tour", description: "The same engine driven by demo/tours/showcase.tour.json.", build: () => createTour(json()) },
  { id: "motion", title: "Motion", description: "glide() and progressVars() from virtual-site-tour/motion.", build: motion },
  {
    id: "avatar",
    title: "Avatar (Thumbtack)",
    description: "withAvatar with the bundled Thumbtack pack and the idle loop on.",
    build: () => createTour({ name: "avatar", animate: false, dim: false, presenter: withAvatar(thumbtackPack(), { idle: true, idleQuietMs: 3000 }), steps: avatarSteps }),
  },
  {
    id: "avatar-classic",
    title: "Avatar (classic format)",
    description: "A classic column/row map loaded through loadClassicAvatarPack, using the generated test sheet.",
    build: () =>
      createTour({
        name: "avatar-classic",
        animate: false,
        dim: false,
        presenter: withAvatar(loadClassicAvatarPack({ sheetUrl: testPack("sheet.png"), mapUrl: testPack("classic-a.json"), name: "Classic test pack" }), { idle: true, idleQuietMs: 3000 }),
        steps: avatarSteps,
      }),
  },
];
