import { fixedNames } from "../engine/core/namespace";
import type { PopoverDOM } from "../engine/popover/popover";

const P = fixedNames.popover;

export const BODY_CLASS = "vt-body";
export const BODY_ID = "vt-popover-body";

const PROTECTED_ATTRS: ReadonlySet<string> = new Set([
  "type",
  "class",
  "id",
  "aria-label",
  "aria-hidden",
  "aria-labelledby",
  "aria-describedby",
  "role",
  "style",
  "hidden",
  "disabled",
  "tabindex",
  "form",
  "formaction",
]);

/** Returns the attributes that may be set on a layer-owned button: drops `type`, `class`, `id`, `aria-label`, `aria-hidden`, `aria-labelledby`, `aria-describedby`, `role`, `style`, `hidden`, `disabled`, `tabindex`, `form`, `formaction` and every `on*`. */
export function guardAttrs(attrs: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!attrs) return out;
  for (const [key, value] of Object.entries(attrs)) {
    const name = key.toLowerCase();
    if (PROTECTED_ATTRS.has(name) || name.startsWith("on")) continue;
    out[key] = String(value);
  }
  return out;
}

/** Sets the guarded attributes on `element`; names the DOM rejects are skipped. */
export function applyAttrs(element: Element, attrs: Record<string, string> | undefined): void {
  for (const [key, value] of Object.entries(guardAttrs(attrs))) {
    try {
      element.setAttribute(key, value);
    } catch {
      continue;
    }
  }
}

function repointDescribedBy(wrapper: HTMLElement, from: string, to: string): void {
  const ids = (wrapper.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  const next = ids.filter((id) => id !== from && id !== to);
  next.unshift(to);
  wrapper.setAttribute("aria-describedby", next.join(" "));
}

/**
 * Builds `.vt-body` holding a deep clone of `content`, inserts it after the engine's description and
 * points `aria-describedby` at it. The element or fragment the caller passed is never moved or emptied, so
 * closing the popover leaves it intact and every later mount gets the same content. The clone does not carry
 * event listeners, form state or properties set from script, and an `id` inside it repeats the original's.
 * The engine's own elements stay in place.
 */
export function mountBody(popover: PopoverDOM, content: Element | DocumentFragment): HTMLElement {
  const body = document.createElement("div");
  body.className = BODY_CLASS;
  body.id = BODY_ID;
  body.appendChild(content.cloneNode(true));
  popover.description.after(body);
  popover.body = body;
  repointDescribedBy(popover.wrapper, P.descriptionId, BODY_ID);
  return body;
}
