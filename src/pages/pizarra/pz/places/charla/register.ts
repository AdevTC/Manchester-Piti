// r14 «La pizarra» · Charla: what the place tells the shell (MARCO.txt § registerPlace). Owned by the CHARLA agent.
// Loaded eagerly by places/index.ts (keep it light: the component itself is lazy).
import { lazy } from "react";
import { registerPlace } from "../../store/registry";

registerPlace("charla", {
  Component: lazy(() => import("./Charla").then((m) => ({ default: m.Charla }))),
});
