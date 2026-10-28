// PLANTILLA · Jugadores (/admin/plantilla), la ficha (/admin/plantilla/<id>), el alta (/admin/plantilla/alta[?dorsal=N])
// y los cromos (/admin/plantilla/cromos): la plantilla en filas (camiseta impresa, dorsal, nombre, línea, estado, lo
// que falta, cuenta) con «Qué falta», el detalle a la derecha en escritorio; la ficha guardada campo a campo con
// «Deshacer»; «La camiseta se estampa mientras escribes»; la navegación «Jugadores · Socios · Capitanes» (board
// part-plantilla.html). `PlantillaArea` is the route of /admin/plantilla: it draws these four screens itself (one
// instance across them, so going from the list to a ficha keeps the list where it was) and the outlet for the rest
// (Socios, Capitanes, Antiguos). Split it as you draw the new screens (and say so: the router is the MARCO's).
// TEMPORARY: today's Plantilla for the four.
import { Outlet, useRouterState, useSearch } from "@tanstack/react-router";
import { Plantilla } from "../../views/Plantilla";
import { Interim } from "../../shell/Interim";
import { useAdmin } from "../../shell/context";
import { screenOf } from "../../shell/places";

const OWN = new Set(["jugadores", "ficha", "alta", "cromos"]);
const toList = { to: "/admin/plantilla", label: "Volver a la plantilla" };

export function PlantillaArea() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return OWN.has(screenOf(pathname).screen) ? <JugadoresScreen /> : <Outlet />;
}

export function JugadoresScreen() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const dorsal = useSearch({ strict: false, select: (s) => (s as { dorsal?: unknown }).dorsal });
  // (a ficha opened from the cromos goes back to them: /admin/plantilla/<id>?vista=cromos)
  const fromCromos = useSearch({ strict: false, select: (s) => (s as { vista?: unknown }).vista === "cromos" });
  const { roster } = useAdmin();
  const info = screenOf(pathname);
  const p = info.playerId ? roster.find((x) => x.id === info.playerId) : undefined;
  const search =
    info.screen === "ficha"
      ? { jugador: info.playerId, ...(fromCromos ? { vista: "cromos" } : {}) }
      : info.screen === "alta"
        ? { nuevo: true, ...(dorsal !== undefined ? { dorsal } : {}) }
        : info.screen === "cromos"
          ? { vista: "cromos" }
          : undefined;
  const head =
    info.screen === "ficha"
      ? { title: p?.name ?? "La ficha", sub: p ? [p.number != null ? `Dorsal ${p.number}` : "", p.position].filter(Boolean).join(" · ") : undefined, back: fromCromos ? { to: "/admin/plantilla/cromos", label: "Volver a los cromos" } : toList }
      : info.screen === "alta"
        ? { title: "Camiseta nueva", sub: "Alta de jugador", back: toList }
        : null;
  return (
    <Interim search={search} head={head}>
      <Plantilla />
    </Interim>
  );
}
