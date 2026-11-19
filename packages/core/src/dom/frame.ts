export type FrameCallback = (now: number) => void;

const subscribers = new Set<{ callback: FrameCallback }>();
let handle: number | null = null;

const canSchedule = (): boolean => typeof requestAnimationFrame === "function";

function tick(): void {
  handle = null;
  const now = performance.now();
  for (const entry of Array.from(subscribers)) {
    if (!subscribers.has(entry)) continue;
    try {
      entry.callback(now);
    } catch (error) {
      console.error(error);
    }
  }
  if (subscribers.size > 0 && handle === null && canSchedule()) handle = requestAnimationFrame(tick);
}

/**
 * Registers `callback` on the shared animation-frame loop and returns its unsubscribe function.
 * One `requestAnimationFrame` serves every subscriber; the loop starts with the first subscriber and
 * stops when the last one leaves. Callbacks receive `performance.now()`. Every call registers its own
 * subscription, so subscribing the same function twice runs it twice and each unsubscribe removes only its own.
 * Where `requestAnimationFrame` does not exist the callback is never called.
 */
export function subscribe(callback: FrameCallback): () => void {
  if (!canSchedule()) return () => undefined;
  const entry = { callback };
  subscribers.add(entry);
  if (handle === null) handle = requestAnimationFrame(tick);
  return () => {
    if (!subscribers.delete(entry)) return;
    if (subscribers.size === 0 && handle !== null) {
      cancelAnimationFrame(handle);
      handle = null;
    }
  };
}
