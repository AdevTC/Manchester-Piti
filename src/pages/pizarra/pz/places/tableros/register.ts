// r14 «La pizarra» · Tableros: what the place tells the shell (MARCO.txt § registerPlace) and its sheets. Owned by the
// TABLEROS agent. Loaded eagerly by places/index.ts (keep it light: the components are lazy).
import { lazyPart } from "../../store/lazyPart";
import { registerPlace, registerSheet } from "../../store/registry";

const sheets = () => import("./Sheets");

registerPlace("tableros", {
  Component: lazyPart(() => import("./Tableros").then((m) => m.Tableros)),
  sub: (P) => {
    const n = P.sel.boards().filter((b) => !b.draft).length;
    return n ? String(n) : "Ninguno";
  },
  primary: (P) => {
    const m = P.sel.me();
    if (P.state.route.sub === "comparar") return { label: "Ir a los tableros", short: "Tableros", icon: "boards", run: () => P.nav("/pizarra/tableros") };
    const can = m.member && !m.socia;
    if (!can && !P.sel.boards().some((b) => !b.draft)) return null;
    return { label: "Nuevo tablero", short: "Nuevo", icon: "plus", run: () => P.act.openSheet("pb-nuevo"), disabled: !can };
  },
});

registerSheet("pb-nuevo", { title: "Tablero nuevo", kicker: "Un punto de partida", Component: lazyPart(() => sheets().then((m) => m.NuevoSheet)) });
registerSheet("pb-tablero", { title: "Tablero", kicker: "Detalles", Component: lazyPart(() => sheets().then((m) => m.TableroSheet)) });
registerSheet("pb-vincular", { title: "Vincular a un partido", kicker: "El partido del tablero", Component: lazyPart(() => sheets().then((m) => m.VincularSheet)) });
registerSheet("pb-mesa", { title: "Borrar las copias de la mesa", kicker: "Partidos jugados", Component: lazyPart(() => sheets().then((m) => m.MesaSheet)) });
registerSheet("pb-quitar", { title: "¿Quitar el oficial?", kicker: "El oficial", Component: lazyPart(() => sheets().then((m) => m.QuitarSheet)) });
