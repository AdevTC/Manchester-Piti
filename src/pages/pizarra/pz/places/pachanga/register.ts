// r14 «La pizarra» · Pachanga: what the place tells the shell (MARCO.txt § registerPlace): the live sublabel
// («6 contra 6»), «Mezclar» as the primary action, the board bar's «Compartir» opening the teams' image, and its
// own sheets. Loaded eagerly by places/index.ts (keep it light: the components are lazy).
import { lazy } from "react";
import { registerPlace, registerSheet } from "../../store/registry";
import { pg, pgSlice, pgSub } from "./pgStore";
import { PG_NAMES } from "./pachangaView";

registerPlace("pachanga", {
  Component: lazy(() => import("./Pachanga").then((m) => ({ default: m.Pachanga }))),
  sub: (P) => pgSub(P),
  primary: (P) => {
    const st = pgSlice(P).get();
    return { label: "Mezclar", short: "Mezclar", icon: "swap", run: () => pg.mezclar(P), disabled: !st || st.comes.length < 2 * st.n };
  },
  share: "pg-compartir",
});
registerSheet("pg-compartir", { title: "Compartir los equipos", kicker: "Una imagen para el grupo", Component: lazy(() => import("./PgSheets").then((m) => ({ default: m.PgCompartirSheet }))) });
registerSheet("pg-pareja", { title: "Juntos o separados", kicker: "Una pareja para el reparto", Component: lazy(() => import("./PgSheets").then((m) => ({ default: m.PgParejaSheet }))) });
registerSheet("pg-portero", { title: (a) => "Portero de " + (typeof a.nombre === "string" && a.nombre ? a.nombre : (PG_NAMES[2][Number(a.t ?? 0)] ?? "su equipo")), kicker: "Porteros fijos", Component: lazy(() => import("./PgSheets").then((m) => ({ default: m.PgPorteroSheet }))) });
