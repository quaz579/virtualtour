import { createTour } from "virtualtour";

const template = document.createElement("template");
template.innerHTML = "<p>Rendered from a template.</p>";

export const tour = createTour({
  id: "bodies",
  sanitize: (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ""),
  steps: [
    { id: "html", title: "<em>HTML</em> title", body: "One <strong>string</strong>." },
    { id: "paragraphs", title: "Paragraphs", body: ["First paragraph.", "Second paragraph."] },
    { id: "element", title: "Element", body: template.content },
    { id: "function", title: () => `Opened at ${new Date().toLocaleTimeString()}`, body: () => "Evaluated on each show." },
    {
      id: "buttons",
      title: "Custom buttons",
      body: "These replace Back and Next.",
      buttons: [
        { text: "Skip", action: "exit", kind: "secondary" },
        { text: "Continue", action: "forward" },
      ],
    },
  ],
});
