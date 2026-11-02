// r14 «La pizarra» · Partido: what the place tells the shell (MARCO.txt § registerPlace). Owned by the PARTIDO agent.
// Loaded eagerly by places/index.ts (keep it light: the component itself is lazy).
import { lazy } from "react";
import { registerPlace } from "../../store/registry";

registerPlace("partido", {
  Component: lazy(() => import("./Partido").then((m) => ({ default: m.Partido }))),
});
