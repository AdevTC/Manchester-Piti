// r14 «La pizarra» · the «Compartir» sheet (?hoja=compartir). Owned by the CHARLA agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";

registerSheet("compartir", {
  title: "Compartir",
  Component: lazy(() => import("./Compartir").then((m) => ({ default: m.CompartirSheet }))),
});
