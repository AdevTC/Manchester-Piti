// TEMPORARY (r12): today's match workspace (MatchEditor) as a station of the new match, until wave 2 draws each
// station (HOY Y PARTIDOS: Datos; ACTA: Acta, Narración, Historial, Publicar). Its own head and tabs hide under the
// carril (sala.css); a tab it opens is the station's address; «Archivar…» and «Borrar…» use the match's dialog.
import { useNavigate } from "@tanstack/react-router";
import type { MatchTab } from "../../shell/nav";
import { useAdmin } from "../../shell/context";
import { useSalaGo } from "../../shell/salaHref";
import { Interim } from "../../shell/Interim";
import { ScreenLoading } from "../../shell/Screen";
import { useMatchNote } from "../../partidos/live";
import { MatchEditor } from "../../partidos/MatchEditor";
import { useMatchShortcuts } from "../../palette/matchShortcuts";
import { usePartido } from "../../partido/partidoContext";
import { useMatchLifecycle } from "../../partido/lifecycle";
import "../../partidos/partidos.css";

const STATION_OF: Record<MatchTab, string> = { encuentro: "datos", convocatoria: "convocatoria", acta: "acta", publicar: "publicar" };

export function MatchEditorStation({ tab }: { tab: MatchTab }) {
  const data = useAdmin();
  const { match, base } = usePartido();
  const note = useMatchNote(match.id);
  const go = useSalaGo();
  const navigate = useNavigate();
  const lifecycle = useMatchLifecycle();
  useMatchShortcuts(match);
  if (note.loading) return <ScreenLoading label="Cargando el acta" />;
  return (
    <Interim>
      <MatchEditor
        key={match.id}
        match={match}
        data={data}
        note={note.data}
        tab={tab}
        onTab={(t) => go(`${base}/${STATION_OF[t]}`)}
        onBack={() => void navigate({ to: "/admin/partidos" })}
        onLifecycle={lifecycle}
        onPublished={() => go(`${base}/despues`)}
      />
    </Interim>
  );
}
