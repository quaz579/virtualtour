const guards = new WeakMap<Element, Map<object, MutationObserver>>();

/** The class VirtualTour adds to the target and the extras of a shown step, for a namespace. */
export function spotlitClass(namespace: string): string {
  return `${namespace}-spotlit`;
}

/**
 * Resolves every selector with `querySelectorAll` and returns the matches in selector-list order without
 * duplicates. A selector that does not parse throws, as it does for the engine's `allowedElements`.
 */
export function resolveExtras(selectors: readonly string[] | undefined, root: ParentNode = document): Element[] {
  const found = new Set<Element>();
  for (const selector of selectors ?? []) {
    root.querySelectorAll(selector).forEach((element) => found.add(element));
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

/** Adds the state classes the element lacks and returns the ones it added, keeping them there if a framework rewrites `className`. */
export function applyStateClasses(element: Element, classes: readonly string[], owner: object = element): string[] {
  const added = classes.filter((name) => !element.classList.contains(name));
  if (added.length > 0) element.classList.add(...added);
  guardClasses(element, added, owner);
  return added;
}

/** Removes the given classes from the element and stops the owner's guard on it. */
export function removeStateClasses(element: Element, added: readonly string[], owner: object = element): void {
  const owners = guards.get(element);
  const guard = owners?.get(owner);
  if (guard) {
    guard.disconnect();
    owners?.delete(owner);
    if (owners?.size === 0) guards.delete(element);
  }
  if (added.length > 0) element.classList.remove(...added);
}

function guardClasses(element: Element, added: readonly string[], owner: object): void {
  if (added.length === 0 || typeof MutationObserver === "undefined") return;
  let owners = guards.get(element);
  if (!owners) {
    owners = new Map();
    guards.set(element, owners);
  }
  owners.get(owner)?.disconnect();
  const guard = new MutationObserver(() => {
    const missing = added.filter((name) => !element.classList.contains(name));
    if (missing.length > 0) element.classList.add(...missing);
  });
  guard.observe(element, { attributes: true, attributeFilter: ["class"] });
  owners.set(owner, guard);
}

/** Splits a class option into individual class names. */
export function classList(value: string | undefined): string[] {
  return value ? value.split(/\s+/).filter(Boolean) : [];
}
