import "./styles/base.css";
import { createTour } from "./tour";

export { Emitter } from "./events";
export type { ExitReason, StepEvents, TourEvents } from "./events";
export { TourEnvironmentError, TourNavigationError } from "./errors";
export { parseTourJson, serializeTour, TourJsonError } from "./json/tour-json";
export type {
  ButtonJsonV1,
  CornerRadiusJson,
  DimJsonV1,
  HandlerRefJson,
  ParseTourJsonOptions,
  SerializeTourOptions,
  StepJsonV1,
  TextJson,
  TourJsonHandler,
  TourJsonV1,
} from "./json/tour-json";
export { localStorageStore } from "./persist/local-storage";
export { memoryStore } from "./persist/memory";
export { tours } from "./registry";
export { TourStep } from "./step";
export { createTour, Tour } from "./tour";
export type * from "./types";

export default createTour;
