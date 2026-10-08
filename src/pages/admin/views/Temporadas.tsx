// Temporadas — TEMPORARY (P0): the old seasons section of Admin until P1b's season cards and modals.
import { Admin } from "../../Admin";
import { AdminView } from "../shell/AdminView";
import { LegacyNote } from "./LegacyNote";

export function Temporadas() {
  return (
    <AdminView kicker="Club" title="Temporadas" lead="Archivar oculta partidos y estadísticas en la web; se puede deshacer. Eliminar no.">
      <div className="vb scr ad-legacy">
        <LegacyNote>La gestión de temporadas de siempre, mientras llega la nueva.</LegacyNote>
        <Admin section="seasons" />
      </div>
    </AdminView>
  );
}
