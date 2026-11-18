import { fixedNames } from "../engine/core/namespace";
import type { PopoverDOM } from "../engine/popover/popover";

const P = fixedNames.popover;

export const BODY_CLASS = "vt-body";
export const BODY_ID = "vt-popover-body";

const PROTECTED_ATTRS: ReadonlySet<string> = new Set(["type", "class", "id", "aria-label", "style"]);

/** Returns the attributes that may be set on a layer-owned button: drops `type`, `class`, `id`, `aria-label`, `style` and every `on*`. */
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
 * Builds `.vt-body` holding `content` (moved, not cloned), inserts it after the engine's description and
 * points `aria-describedby` at it. The engine's own elements stay in place.
 */
export function mountBody(popover: PopoverDOM, content: Element): HTMLElement {
  const body = document.createElement("div");
  body.className = BODY_CLASS;
  body.id = BODY_ID;
  body.appendChild(content);
  popover.description.after(body);
  repointDescribedBy(popover.wrapper, P.descriptionId, BODY_ID);
  return body;
}
