// r14 «La pizarra» · Jugadas: what the place tells the shell (MARCO.txt § registerPlace). Owned by the JUGADAS agent.
// Loaded eagerly by places/index.ts (keep it light: the component itself is lazy).
import { lazy } from "react";
import { registerPlace } from "../../store/registry";

registerPlace("jugadas", {
  Component: lazy(() => import("./Jugadas").then((m) => ({ default: m.Jugadas }))),
});
