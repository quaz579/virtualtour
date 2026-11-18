import "../packages/core/src/styles/base.css";
import { createEngine } from "../packages/core/src/engine/driver";

Object.assign(window, { __engine: { createEngine }, log: [] });
document.documentElement.dataset.ready = "true";
