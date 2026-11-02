// r14 «La pizarra» · the «Candidatos» sheet (?hoja=candidatos&hueco=<i>): «¿Quién al MC?». Owned by the SIETE agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";
import { sieteApi } from "../../places/siete/sieteApi";

registerSheet("candidatos", {
  title: (a) => {
    const P = sieteApi();
    const i = typeof a.hueco === "number" ? a.hueco : typeof a.slot === "number" ? a.slot : (P?.state.slotPick ?? null);
    const code = P && i != null ? P.sel.ver()?.slots[i]?.code : null;
    return code ? "¿Quién al " + code + "?" : "Candidatos";
  },
  kicker: "Los que mejor encajan, primero",
  Component: lazy(() => import("./Candidatos").then((m) => ({ default: m.CandidatosSheet }))),
});
