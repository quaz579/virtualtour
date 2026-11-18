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
    const origin = event.composedPath()[0];
    const target = origin instanceof Element ? origin : event.target;
    if (!(target instanceof Element)) return;
    let matched: Element | null = null;
    try {
      matched = target.closest(selector);
    } catch {
      matched = null;
    }
    if (!matched) return;
    fired = true;
    detach();
    onAdvance();
  }
  for (const name of names) document.addEventListener(name, handler, true);
  return detach;
}
