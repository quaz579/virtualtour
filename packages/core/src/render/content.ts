import type { BodyContent } from "../types";

/** A function that cleans an HTML string before it reaches the page. */
export type Sanitizer = ((html: string) => string) | undefined;

/** A body resolved for the engine: HTML for its description, or an element for the layer's body part. */
export interface ResolvedBody {
  description?: string;
  element?: Element | DocumentFragment;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function cleanParts(html: string, sanitize: Sanitizer): { html: string; failed: boolean } {
  if (!sanitize) return { html, failed: false };
  let clean: unknown;
  try {
    clean = sanitize(html);
  } catch (error) {
    console.error("[virtualtour] sanitize threw; the text is shown as plain text:", error);
    return { html: escapeHtml(html), failed: true };
  }
  if (typeof clean === "string") return { html: clean, failed: false };
  console.error("[virtualtour] sanitize did not return a string; the text is shown as plain text.");
  return { html: escapeHtml(html), failed: true };
}

/** Runs `html` through the sanitizer when there is one. */
export function cleanHtml(html: string, sanitize: Sanitizer): string {
  return cleanParts(html, sanitize).html;
}

/** Resolves a text value; a function is called only when `evaluate` is true. */
export function resolveText(value: string | (() => string) | undefined, evaluate: boolean): string | undefined {
  if (typeof value === "function") return evaluate ? value() : undefined;
  return value;
}

/** Resolves a title to sanitized HTML; a function is called only when `evaluate` is true. */
export function resolveTitle(
  value: string | (() => string) | undefined,
  evaluate: boolean,
  sanitize: Sanitizer
): string | undefined {
  const text = resolveText(value, evaluate);
  return text === undefined ? undefined : cleanHtml(text, sanitize);
}

/**
 * Resolves a body by its type: a string is one sanitized HTML string, a string array becomes one sanitized
 * `<p>` per entry, an element or fragment is passed through untouched, and a function is called (only when `evaluate` is
 * true) and handled by what it returns.
 */
export function resolveBody(body: BodyContent | undefined, evaluate: boolean, sanitize: Sanitizer): ResolvedBody {
  const value = typeof body === "function" ? (evaluate ? body() : undefined) : body;
  if (typeof value === "string") return { description: cleanHtml(value, sanitize) };
  if (Array.isArray(value)) {
    const parts = value.map((p) => cleanParts(p, sanitize));
    if (parts.some((part) => part.failed)) return { description: escapeHtml(value.join(" ")) };
    return { description: parts.map((part) => `<p>${part.html}</p>`).join("") };
  }
  if (value !== undefined && value !== null && typeof (value as Element).nodeType === "number") {
    return { element: value as Element | DocumentFragment };
  }
  return {};
}

/**
 * Wraps a sanitizer so each distinct HTML string is cleaned once until `clear` is called, and a string the
 * wrapper itself produced is returned as is, so passing sanitized HTML through again never cleans it twice.
 */
export function memoizeSanitizer(sanitize: (html: string) => string): {
  sanitize: (html: string) => string;
  clear: () => void;
} {
  const cache = new Map<string, string>();
  const produced = new Set<string>();
  return {
    sanitize(html) {
      if (produced.has(html)) return html;
      let out = cache.get(html);
      if (out === undefined) {
        out = sanitize(html);
        cache.set(html, out);
        produced.add(out);
      }
      return out;
    },
    clear: () => {
      cache.clear();
      produced.clear();
    },
  };
}
