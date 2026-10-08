// Convocatorias — TEMPORARY (P0): until P1a builds the per-match convocatoria view, the convocatoria is
// edited in the «Convocatoria» step of each match (the old MatchEditor).
import { MatchEditor } from "../MatchEditor";
import { AdminView } from "../shell/AdminView";
import { LegacyNote } from "./LegacyNote";

export function Convocatorias() {
  return (
    <AdminView kicker="Jornada" title="Convocatorias" lead="Titular, suplente o no convocado, partido a partido. Máximo siete titulares.">
      <div className="vb scr ad-legacy">
        <LegacyNote>De momento, la convocatoria se hace en el paso «Convocatoria» de cada partido.</LegacyNote>
        <MatchEditor />
      </div>
    </AdminView>
  );
}
