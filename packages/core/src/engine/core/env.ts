export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function prefersReducedMotion(): boolean {
  if (!isBrowser() || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
