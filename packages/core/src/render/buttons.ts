import { resolveText } from "./content";
import type { Sanitizer } from "./content";
import { applyAttrs, guardAttrs } from "./parts";
import type { PopoverDOM } from "../engine/popover/popover";
import type { TourStep } from "../step";
import type { Tour } from "../tour";
import type { ButtonConfig, StepParts } from "../types";

export const FOOTER_CLASS = "vt-footer";
export const BUTTON_CLASS = "vt-button";
export const SECONDARY_CLASS = "vt-button--secondary";

const applied = new WeakMap<HTMLButtonElement, string[]>();
const configs = new WeakMap<HTMLElement, { tour: Tour; step: TourStep; buttons: ButtonConfig[] }>();

function evaluate<T>(value: T | (() => T) | undefined, fallback: T): T {
  if (typeof value !== "function") return value ?? fallback;
  try {
    return (value as () => T)() ?? fallback;
  } catch (error) {
    console.error("[virtualtour] A button function threw; its default is used:", error);
    return fallback;
  }
}

function setLabel(button: HTMLButtonElement, text: string, sanitize: Sanitizer): void {
  if (!text.includes("<") || !sanitize) {
    button.textContent = text;
    return;
  }
  let clean: unknown;
  try {
    clean = sanitize(text);
  } catch {
    clean = undefined;
  }
  if (typeof clean === "string") button.innerHTML = clean;
  else button.textContent = text;
}

function classesOf(config: ButtonConfig): string[] {
  const extra = Array.isArray(config.classes) ? config.classes : (config.classes ?? "").split(/\s+/);
  const out = [BUTTON_CLASS];
  if (config.kind === "secondary") out.push(SECONDARY_CLASS);
  for (const name of extra) if (name) out.push(name);
  return out;
}

function paint(button: HTMLButtonElement, config: ButtonConfig, sanitize: Sanitizer): void {
  setLabel(button, evaluate<string>(config.text, ""), sanitize);
  button.className = classesOf(config).join(" ");
  button.type = "button";
  for (const name of applied.get(button) ?? []) button.removeAttribute(name);
  const label = resolveText(config.label, true);
  if (label) button.setAttribute("aria-label", label);
  else button.removeAttribute("aria-label");
  applyAttrs(button, config.attrs);
  applied.set(button, Object.keys(guardAttrs(config.attrs)));
  button.disabled = Boolean(evaluate<boolean>(config.disabled, false));
}

function run(tour: Tour, step: TourStep, config: ButtonConfig): void {
  const action = config.action;
  const fail = (error: unknown): void => console.error("[virtualtour] Button action failed:", error);
  if (typeof action === "function") {
    try {
      action({ tour, step });
    } catch (error) {
      fail(error);
    }
    return;
  }
  let result: unknown;
  try {
    if (action === "forward") result = tour.forward();
    else if (action === "backward") result = tour.backward();
    else if (action === "exit") result = tour.exit();
    else if (action === "finish") tour.finish();
    else console.warn(`[virtualtour] Button action ${JSON.stringify(action)} is not one of forward, backward, exit, finish or a function; nothing happened.`);
  } catch (error) {
    fail(error);
  }
  if (result instanceof Promise) result.catch(fail);
}

function ensureFooter(popover: PopoverDOM, parts: StepParts): HTMLElement {
  if (parts.footer && parts.footer.isConnected) return parts.footer;
  const footer = document.createElement("div");
  footer.className = FOOTER_CLASS;
  popover.footer.after(footer);
  footer.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(`.${BUTTON_CLASS}`) : null;
    const state = configs.get(footer);
    if (!target || !state || target.disabled) return;
    const index = Array.from(footer.children).indexOf(target);
    const config = state.buttons[index];
    if (config) run(state.tour, state.step, config);
  });
  parts.footer = footer;
  return footer;
}

/**
 * Builds or updates `.vt-footer` next to the engine's own footer so it holds one `.vt-button` per entry of
 * `buttons`, reusing existing button elements so focus survives an update. Without `buttons` the footer is removed.
 * Labels pass through `sanitize`; `disabled`, `text` and `label` functions are evaluated now.
 */
export function syncFooter(
  popover: PopoverDOM,
  parts: StepParts,
  tour: Tour,
  step: TourStep,
  buttons: ButtonConfig[] | undefined,
  sanitize: Sanitizer
): void {
  if (!buttons || buttons.length === 0) {
    const held = parts.footer?.contains(document.activeElement) ?? false;
    parts.footer?.remove();
    if (held) popover.wrapper.focus();
    delete parts.footer;
    parts.buttons = [];
    return;
  }
  const footer = ensureFooter(popover, parts);
  configs.set(footer, { tour, step, buttons });
  const existing = Array.from(footer.querySelectorAll<HTMLButtonElement>(`:scope > .${BUTTON_CLASS}`));
  const list: HTMLButtonElement[] = [];
  buttons.forEach((config, index) => {
    const button = existing[index] ?? footer.appendChild(document.createElement("button"));
    paint(button, config, sanitize);
    list.push(button);
  });
  for (const extra of existing.slice(buttons.length)) extra.remove();
  parts.buttons = list;
}

/** Moves focus to the first enabled layer button; returns whether one took it. */
export function focusFirstButton(parts: StepParts): boolean {
  const first = parts.buttons.find((button) => !button.disabled && button.isConnected);
  if (!first) return false;
  first.focus();
  return true;
}
