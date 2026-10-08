// Fichas — TEMPORARY (P0): the old PlayerClaims list until P1b's redesign (pending + resolved, undo toasts).
import { PlayerClaims } from "../PlayerClaims";
import { AdminView } from "../shell/AdminView";
import { LegacyNote } from "./LegacyNote";

export function Fichas() {
  return (
    <AdminView kicker="Jornada" title="Fichas" lead="Socios que piden unir su cuenta a un jugador de la plantilla. Aprobar le deja votar el MVP.">
      <div className="vb scr ad-legacy">
        <LegacyNote>La lista de fichas de siempre, mientras llega la nueva.</LegacyNote>
        <PlayerClaims />
      </div>
    </AdminView>
  );
}
