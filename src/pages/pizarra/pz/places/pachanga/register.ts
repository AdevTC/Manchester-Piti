// r14 «La pizarra» · Pachanga: what the place tells the shell (MARCO.txt § registerPlace). Owned by the PACHANGA agent.
// Loaded eagerly by places/index.ts (keep it light: the component itself is lazy).
import { lazy } from "react";
import { registerPlace } from "../../store/registry";

registerPlace("pachanga", {
  Component: lazy(() => import("./Pachanga").then((m) => ({ default: m.Pachanga }))),
});
