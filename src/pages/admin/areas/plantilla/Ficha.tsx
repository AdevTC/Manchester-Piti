// PLANTILLA · la ficha (/admin/plantilla/<id>): camiseta, estado, posiciones, datos, cuenta y web, historia,
// temporadas, ausencias, baja; guardado campo a campo con «Deshacer» (board part-plantilla.html § ficha). Inside a
// ficha the dock hides and «‹» goes back to the list (useSalaHead / SalaScreen `back`). TEMPORARY: today's Plantilla
// with the player open.
import { useParams } from "@tanstack/react-router";
import { Plantilla } from "../../views/Plantilla";
import { Interim } from "../../shell/Interim";
import { useAdmin } from "../../shell/context";

export function FichaScreen() {
  const { playerId = "" } = useParams({ strict: false }) as { playerId?: string };
  const { roster } = useAdmin();
  const p = roster.find((x) => x.id === playerId);
  return (
    <Interim search={{ jugador: playerId }} head={{ title: p?.name ?? "La ficha", sub: p ? [p.number != null ? `Dorsal ${p.number}` : "", p.position].filter(Boolean).join(" · ") : undefined, back: { to: "/admin/plantilla", label: "Volver a la plantilla" } }}>
      <Plantilla />
    </Interim>
  );
}
