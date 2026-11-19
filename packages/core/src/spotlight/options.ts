const guards = new WeakMap<Element, MutationObserver>();

/** The class VirtualTour adds to the target and the extras of a shown step, for a namespace. */
export function spotlitClass(namespace: string): string {
  return `${namespace}-spotlit`;
}

/**
 * Resolves every selector with `querySelectorAll` and returns the matches in selector-list order without
 * duplicates. A selector that does not parse is skipped.
 */
export function resolveExtras(selectors: readonly string[] | undefined, root: ParentNode = document): Element[] {
  const found = new Set<Element>();
  for (const selector of selectors ?? []) {
    let matches: NodeListOf<Element>;
    try {
      matches = root.querySelectorAll(selector);
    } catch {
      continue;
    }
    matches.forEach((element) => found.add(element));
  }
  return Array.from(found);
}

/**
 * Drops the elements that sit inside the target or inside another extra, and the repeats of an element already kept,
 * so state classes go on the outermost extras only.
 */
export function dedupeExtras(elements: readonly Element[], target?: Element | null): Element[] {
  const unique = Array.from(new Set(elements));
  return unique.filter((element) => {
    if (target && target.contains(element)) return false;
    return !unique.some((other) => other !== element && other.contains(element));
  });
}

/** Adds the state classes to each element and keeps them there if a framework rewrites `className`. */
export function applyStateClasses(elements: Iterable<Element>, classes: readonly string[]): void {
  for (const element of elements) {
    element.classList.add(...classes);
    guardClasses(element, classes);
  }
}

/** Removes the state classes from each element and stops guarding them. */
export function removeStateClasses(elements: Iterable<Element>, classes: readonly string[]): void {
  for (const element of elements) {
    const guard = guards.get(element);
    if (guard) {
      guard.disconnect();
      guards.delete(element);
    }
    element.classList.remove(...classes);
  }
}

function guardClasses(element: Element, classes: readonly string[]): void {
  if (guards.has(element) || typeof MutationObserver === "undefined") return;
  const guard = new MutationObserver(() => {
    const missing = classes.filter((name) => !element.classList.contains(name));
    if (missing.length > 0) element.classList.add(...missing);
  });
  guard.observe(element, { attributes: true, attributeFilter: ["class"] });
  guards.set(element, guard);
}

/** Splits a class option into individual class names. */
export function classList(value: string | undefined): string[] {
  return value ? value.split(/\s+/).filter(Boolean) : [];
}
