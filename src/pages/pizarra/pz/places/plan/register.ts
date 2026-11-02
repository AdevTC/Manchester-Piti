// r14 «La pizarra» · Plan: what the place tells the shell (MARCO.txt § registerPlace). Owned by the PLAN agent.
// Loaded eagerly by places/index.ts (keep it light: the component itself is lazy).
import { lazy } from "react";
import { registerPlace } from "../../store/registry";

registerPlace("plan", {
  Component: lazy(() => import("./Plan").then((m) => ({ default: m.Plan }))),
});
