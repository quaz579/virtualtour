import "./styles/base.css";

/** Placeholder returned by {@link createTour} until the public API lands. */
export interface Tour {
  readonly placeholder: true;
}

/**
 * Creates a tour. Placeholder: the real configuration and lifecycle API arrives in a later milestone.
 */
export function createTour(): Tour {
  return { placeholder: true };
}

export default createTour;
