import { createTour } from "virtual-site-tour";

const ALLOWED = new Set(["B", "I", "EM", "STRONG", "CODE", "A", "BR", "P", "UL", "OL", "LI"]);

export function sanitizeHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const clean = (parent: Node): void => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) continue;
      if (!(node instanceof Element) || !ALLOWED.has(node.tagName)) {
        node.remove();
        continue;
      }
      for (const attribute of Array.from(node.attributes)) {
        const safeLink =
          node.tagName === "A" && attribute.name === "href" && /^(https?:|mailto:|\/(?!\/))/i.test(attribute.value.trim());
        if (!safeLink) node.removeAttribute(attribute.name);
      }
      clean(node);
    }
  };
  clean(template.content);
  return template.innerHTML;
}

export const tour = createTour({
  sanitize: sanitizeHtml,
  steps: [{ title: "Hello <b>there</b>", body: "Read the <a href='/help'>help page</a>." }],
});
