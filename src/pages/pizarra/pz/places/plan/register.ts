// r14 «La pizarra» · Plan: what the place tells the shell (MARCO.txt § registerPlace). Owned by the PLAN agent.
// Loaded eagerly by places/index.ts (keep it light: the components are lazy).
import { lazyPart } from "../../store/lazyPart";
import { registerPlace, registerSheet } from "../../store/registry";
import { fmt } from "../../store/fmt";
import { partsStatus } from "./planPlace";
import { PLAN_PARTS, planOf } from "./planView";

registerPlace("plan", {
  Component: lazyPart(() => import("./Plan").then((m) => m.Plan)),
  sub: (P) => {
    const b = P.sel.board();
    if (!b) return "Sin tablero";
    const s = partsStatus(P);
    return s.miss.length ? s.done + " de 5" : fmt.plural(planOf(b.lineup).claves.length, "clave", "claves");
  },
  primary: (P) => {
    const b = P.sel.board();
    if (!b) return null;
    const s = partsStatus(P);
    if (P.sel.canEdit(b) && s.miss.length) {
      const id = s.miss[0];
      const p = PLAN_PARTS.find((x) => x.id === id) ?? PLAN_PARTS[0];
      return { label: "Completar: " + p.t.toLowerCase(), short: "Completar", icon: p.icon, run: () => P.nav("/pizarra/plan/" + id) };
    }
    return { label: "La charla", short: "Charla", icon: "mic", run: () => P.nav("/pizarra/charla") };
  },
});
registerSheet("plan-vistazo", {
  title: "El plan de un vistazo",
  kicker: "Lo que cuenta la charla",
  Component: lazyPart(() => import("./PlanSheets").then((m) => m.GlanceSheet)),
});
registerSheet("plan-jugada", {
  title: (a) => "La jugada " + (a.k === "freekicks" ? "de la falta" : "del córner"),
  kicker: "Pelotas paradas",
  Component: lazyPart(() => import("./PlanSheets").then((m) => m.PlayPickSheet)),
});
