/** Thrown when an operation needs a browser and there is none, or a required page element is missing. */
export class TourEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TourEnvironmentError";
  }
}

/** Thrown when a step cannot be found, placed or created: an unknown id or index, or a duplicate step id. */
export class TourNavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TourNavigationError";
  }
}
