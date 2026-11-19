import type { TargetRef } from "../types";

const POLL_MS = 250;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function lookup(value: string | Element | null | undefined): Element | null {
  if (typeof document === "undefined" || value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return document.querySelector(value);
    } catch {
      return null;
    }
  }
  return value.isConnected ? value : null;
}

/** Resolves a step target to a connected element, or `null` when it is absent, detached, an invalid selector, or a function that throws. */
export function resolveTarget(ref: TargetRef | undefined): Element | null {
  if (ref === undefined) return null;
  if (typeof ref !== "function") return lookup(ref);
  try {
    return lookup(ref());
  } catch {
    return null;
  }
}

/**
 * Resolves with the target as soon as it exists, or `null` after `ms` milliseconds or when `signal` aborts. Watches
 * the document with a MutationObserver (checked at most once per frame) and a 250 ms poll; everything is released
 * when the promise settles.
 */
export function waitForTarget(ref: TargetRef | undefined, ms: number, signal?: AbortSignal | null): Promise<Element | null> {
  const found = resolveTarget(ref);
  if (found) return Promise.resolve(found);
  if (!(ms > 0) || signal?.aborted || typeof document === "undefined") return Promise.resolve(null);
  return new Promise<Element | null>((resolve) => {
    let done = false;
    let frame = 0;
    let observer: MutationObserver | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (value: Element | null): void => {
      if (done) return;
      done = true;
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      clearInterval(poll);
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const check = (): void => {
      frame = 0;
      const el = resolveTarget(ref);
      if (el) settle(el);
    };
    const onAbort = (): void => settle(null);

    observer = new MutationObserver(() => {
      if (!frame && !done) frame = requestAnimationFrame(check);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    poll = setInterval(check, POLL_MS);
    timer = setTimeout(() => settle(resolveTarget(ref)), Math.min(ms, MAX_TIMEOUT_MS));
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
