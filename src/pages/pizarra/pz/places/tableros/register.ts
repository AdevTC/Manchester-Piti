// r14 «La pizarra» · Tableros: what the place tells the shell (MARCO.txt § registerPlace). Owned by the TABLEROS agent.
// Loaded eagerly by places/index.ts (keep it light: the component itself is lazy).
import { lazy } from "react";
import { registerPlace } from "../../store/registry";

registerPlace("tableros", {
  Component: lazy(() => import("./Tableros").then((m) => ({ default: m.Tableros }))),
});
