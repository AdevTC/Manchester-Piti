// r14 «La pizarra» · Siete: what the place tells the shell (MARCO.txt § registerPlace) and its own sheets
// («Empezar desde…», a galón). Loaded eagerly by places/index.ts (keep it light: the components are lazy).
import { lazy } from "react";
import { registerPlace, registerSheet } from "../../store/registry";
import { GALONES } from "../../store/store";
import { bindSieteApi } from "./sieteApi";

registerPlace("siete", {
  sub: (P) => {
    bindSieteApi(P);
    const b = P.sel.board();
    const st = P.sel.status();
    return !b ? "Sin empezar" : st.full ? (b.isOfficial ? "Oficial" : "Listo") : st.n + " de 7";
  },
  // the one primary action: Sugerir until the seven is full, then Publicar (a captain) or La charla
  primary: (P) => {
    bindSieteApi(P);
    const b = P.sel.board();
    const st = P.sel.status();
    const m = P.sel.me();
    const charla = { label: "La charla", short: "Charla", icon: "mic", run: () => P.nav("/pizarra/charla") };
    if (!b || !P.sel.canEdit(b)) return b?.isOfficial ? charla : null;
    if (!st.full) return { label: "Sugerir siete", short: "Sugerir", icon: "spark", run: () => P.act.suggest() };
    if (m.cap && !b.isOfficial) return { label: "Publicar", short: "Publicar", icon: "send", run: () => P.act.openSheet("publicar") };
    return charla;
  },
  share: "compartir",
  Component: lazy(() => import("./Siete").then((m) => ({ default: m.Siete }))),
});

registerSheet("desde", {
  title: "Empezar desde…",
  kicker: "Un punto de partida",
  Component: lazy(() => import("./SieteSheets").then((m) => ({ default: m.DesdeSheet }))),
});
registerSheet("galones", {
  title: (a) => GALONES.find((g) => g.k === a.k)?.t ?? "Galones",
  kicker: "Galones y lanzadores",
  Component: lazy(() => import("./SieteSheets").then((m) => ({ default: m.GalonesSheet }))),
});
