export type FrameCallback = (now: number) => void;

const subscribers = new Set<FrameCallback>();
let handle: number | null = null;

function tick(): void {
  handle = null;
  const now = performance.now();
  for (const callback of Array.from(subscribers)) {
    if (!subscribers.has(callback)) continue;
    try {
      callback(now);
    } catch (error) {
      console.error(error);
    }
  }
  if (subscribers.size > 0 && handle === null) handle = requestAnimationFrame(tick);
}

/**
 * Registers `callback` on the shared animation-frame loop and returns its unsubscribe function.
 * One `requestAnimationFrame` serves every subscriber; the loop starts with the first subscriber and
 * stops when the last one leaves. Callbacks receive `performance.now()`.
 */
export function subscribe(callback: FrameCallback): () => void {
  subscribers.add(callback);
  if (handle === null) handle = requestAnimationFrame(tick);
  return () => {
    if (!subscribers.delete(callback)) return;
    if (subscribers.size === 0 && handle !== null) {
      cancelAnimationFrame(handle);
      handle = null;
    }
  };
}
