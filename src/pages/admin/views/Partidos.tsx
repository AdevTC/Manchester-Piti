// Partidos y actas — TEMPORARY (P0): the designed view header over the old MatchEditor, so nothing is
// lost until P1a replaces this file with the master–detail view (list + /admin/partidos/$matchId).
import { Outlet } from "@tanstack/react-router";
import { MatchEditor } from "../MatchEditor";
import { AdminView } from "../shell/AdminView";
import { useAdmin } from "../shell/context";
import { LegacyNote } from "./LegacyNote";

export function Partidos() {
  const data = useAdmin();
  const hacer = data.overview.counters.partidos.n;
  return (
    <AdminView kicker="Jornada" title="Partidos y actas" lead={`${data.matches.length} partidos · ${hacer} por hacer · toca un partido para abrirlo`}>
      <div className="vb scr ad-legacy">
        <LegacyNote>El editor de actas de siempre, mientras llega el nuevo.</LegacyNote>
        <MatchEditor />
        <Outlet />
      </div>
    </AdminView>
  );
}

/** /admin/partidos/$matchId — P1a renders the selected match here (tabs Encuentro · Convocatoria · Acta · Publicar). */
export function PartidoDetail() {
  return null;
}
