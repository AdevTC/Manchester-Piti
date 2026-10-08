// Plantilla — TEMPORARY (P0): the old roster section of Admin until P1b's table + edit drawer.
import { Admin } from "../../Admin";
import { AdminView } from "../shell/AdminView";
import { useAdmin } from "../shell/context";
import { LegacyNote } from "./LegacyNote";

export function Plantilla() {
  const data = useAdmin();
  return (
    <AdminView kicker="Club" title="Plantilla" lead={`${data.roster.length} jugadores${data.season ? ` en la ${data.season.name}` : ""}. El dorsal es único por temporada.`}>
      <div className="vb scr ad-legacy">
        <LegacyNote>El formulario de plantilla de siempre, mientras llega el nuevo.</LegacyNote>
        <Admin section="roster" />
      </div>
    </AdminView>
  );
}
