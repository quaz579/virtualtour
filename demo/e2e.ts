import "../packages/core/src/styles/base.css";
import { createEngine } from "../packages/core/src/engine/driver";
import { createTour } from "../packages/core/src/index";

Object.assign(window, { __engine: { createEngine }, __tour: { createTour }, log: [] });
document.documentElement.dataset.ready = "true";
