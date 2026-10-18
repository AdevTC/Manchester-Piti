// «La luz del partido»: CDM Palomeras lit by the real sun and weather. No three.js in here: the WebGL engine
// is a lazy chunk (./engine) loaded by the components after the page has loaded.
export { Palomeras } from "./Palomeras";
export { PalomerasSlices } from "./PalomerasSlices";
export { skyCss, skyAt, lightingOf, weatherKind, madridMinutes, mix } from "./light";
export { horizonFraction, rigDef, rigKey, sunScreen, SCRUB0, SCRUB1 } from "./rigs";
export { pitchToWorld, worldToPitch, SPONSORS } from "./scene";
export type { GroundMode } from "./useGround";
export type {
  PalomerasFigure,
  PalomerasHandle,
  PalomerasRig,
  PalomerasSliceView,
  PalomerasState,
  WeatherKind,
} from "./types";
