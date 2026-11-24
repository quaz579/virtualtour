import { createTour } from "virtual-site-tour";

export function elementBodyTour(template: HTMLTemplateElement) {
  return createTour({
    sanitize: (html) => html.replace(/<[^>]*>/g, ""),
    steps: [{ title: "Rich body", body: template.content }],
  });
}
