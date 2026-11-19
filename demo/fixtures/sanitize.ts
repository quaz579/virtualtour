import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";
import { engineOf } from "../../packages/core/src/tour";

declare global {
  interface Window {
    vtTour: Tour;
    vtEngine: () => ReturnType<typeof engineOf>;
    vtLog: string[];
    vtPayload: string;
    __vtPwned?: number;
  }
}

const mark = "window.__vtPwned=(window.__vtPwned||0)+1";
const payload = [
  `<script>${mark}</script>`,
  `<img src=x onerror="${mark}">`,
  `<a href="javascript:${mark}">go</a>`,
  `<svg onload="${mark}"></svg>`,
].join("");
window.vtPayload = `ok${payload}`;

const URL_ATTRS = ["href", "src", "xlink:href", "action", "formaction"];

function sanitize(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const el of Array.from(template.content.querySelectorAll("*"))) {
    if (/^(script|style|iframe|object|embed)$/i.test(el.tagName)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const isJs = URL_ATTRS.includes(name) && /^\s*javascript:/i.test(attr.value);
      if (name.startsWith("on") || isJs) el.removeAttribute(attr.name);
    }
  }
  return template.innerHTML;
}

const raw = new URLSearchParams(location.search).has("raw");

const note = document.createElement("div");
note.id = "orig-body";
note.textContent = "Original element body";
document.querySelector(".demo-container")!.append(note);

const fragment = document.createDocumentFragment();
const fragmentNote = document.createElement("p");
fragmentNote.className = "fragment-note";
fragmentNote.textContent = "Fragment body";
fragment.append(fragmentNote);

const p = window.vtPayload;
const tour = createTour({
  name: "sanitize",
  animate: false,
  ...(raw ? {} : { sanitize }),
  counter: () => p,
  labels: { next: `Next${payload}`, back: `Back${payload}`, done: `Done${payload}` },
  steps: [
    { id: "first", title: p, body: p, instruction: p },
    { id: "array", title: "Array", body: [p, p] },
    { id: "element", title: "Element", body: note },
    { id: "fragment", title: "Fragment", body: fragment },
  ],
});

window.vtTour = tour;
window.vtEngine = () => engineOf(tour);
window.vtLog = [];
tour.on("step-shown", (e) => window.vtLog.push(`shown:${e.step.id}`));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});

document.documentElement.dataset.ready = "true";
