/**
 * Calls `onAdvance` once when one of `events` reaches an element matching `selector`. The listener sits on the
 * document in the capture phase, so handlers that stop propagation cannot hide the event. Returns a function that
 * removes the listeners.
 */
export function listenForAdvance(selector: string, events: string | readonly string[], onAdvance: () => void): () => void {
  const names = typeof events === "string" ? [events] : events;
  let fired = false;
  const detach = (): void => {
    for (const name of names) document.removeEventListener(name, handler, true);
  };
  function handler(event: Event): void {
    if (fired) return;
    const path = event.composedPath();
    let matched = false;
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      try {
        if (node.matches(selector)) {
          matched = true;
          break;
        }
      } catch {
        return;
      }
    }
    if (!matched) return;
    fired = true;
    detach();
    onAdvance();
  }
  for (const name of names) document.addEventListener(name, handler, true);
  return detach;
}
