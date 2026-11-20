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

/**
 * Runs `html` through the sanitizer when there is one. A hook that throws, or returns something other than a string,
 * logs an error and the text comes back escaped, so it shows as plain text.
 */
export function cleanHtml(html: string, sanitize: Sanitizer): string {
  if (!sanitize) return html;
  let clean: unknown;
  try {
    clean = sanitize(html);
  } catch (error) {
    console.error("[virtualtour] sanitize threw; the text is shown as plain text:", error);
    return escapeHtml(html);
  }
  if (typeof clean === "string") return clean;
  console.error("[virtualtour] sanitize did not return a string; the text is shown as plain text.");
  return escapeHtml(html);
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
  if (Array.isArray(value)) return { description: value.map((p) => `<p>${cleanHtml(p, sanitize)}</p>`).join("") };
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
