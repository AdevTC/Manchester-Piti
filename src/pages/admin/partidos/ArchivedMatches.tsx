import { useMemo } from "react";
import { eventMinute } from "../../../../functions/src/matchEngine";
import { EVENT_LABELS, dateMillis } from "../../../lib/clubData";
import { namesFor } from "../acta/roster";
import { clockTime, shortDate } from "../data/adminLogic";
import { matchIdentity, type ArchivedMatch, type MatchLifecycleRequest } from "../data/archivedMatches";
import type { AdminData } from "../data/useAdminData";
import { AdIcon } from "../ui/icons";

export function ArchivedMatchList({ matches, query, onQuery, onOpen, selectedId, loading, error }: {
  matches: ArchivedMatch[]; query: string; onQuery: (q: string) => void; onOpen: (id: string) => void;
  selectedId: string | null; loading: boolean; error: boolean;
}) {
  const rows = useMemo(() => matches.filter((m) => (m.rival ?? "").toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))), [matches, query]);
  return <div className="ml archive-list">
    <label className="srch"><AdIcon name="search" /><input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Buscar rival archivado" aria-label="Buscar partido archivado" /></label>
    <p className="hint archive-list-note">Fuera del calendario y de las estadísticas. Puedes consultar el acta o reactivar el partido.</p>
    <div className="scr">
      {loading ? <p role="status">Cargando partidos archivados…</p> : error ? <p className="bad" role="alert">No se han podido cargar los archivos. Se volverá a intentar al recuperar la conexión.</p> : <div className="mg" role="group" aria-label="Partidos archivados">
        {rows.map((m) => <button className="mr" key={m.id} type="button" onClick={() => onOpen(m.id)} aria-current={m.id === selectedId ? "true" : undefined} aria-label={`Archivado, ${matchIdentity(m)}`}>
          <span className="j"><b>{m.published ? "Acta" : "Borrador"}</b><small>{shortDate(dateMillis(m.date))}</small></span>
          <span className="w"><b>{m.rival || "Rival pendiente"}</b><small>{m.individuallyArchived ? "Archivado individualmente" : "Temporada archivada"}{m.draft && m.published ? " · con borrador" : ""}</small></span>
          <span className="s t">{m.status === "finished" && m.goalsFor != null && m.goalsAgainst != null ? `${m.goalsFor}–${m.goalsAgainst}` : clockTime(dateMillis(m.date))}</span>
        </button>)}
        {!rows.length && <p className="hint">{query.trim() ? `Ningún partido archivado con «${query.trim()}».` : "No hay partidos archivados."}</p>}
      </div>}
    </div>
  </div>;
}

/** No editor, live shortcuts, or publishing controls are mounted for an archived match. */
export function ArchivedMatchPane({ match, data, onBack, onLifecycle }: { match: ArchivedMatch; data: AdminData; onBack: () => void; onLifecycle: (r: MatchLifecycleRequest) => void }) {
  const season = data.seasons.find((s) => s.id === match.seasonId);
  const players = [...data.players, ...data.archivedPlayers.filter((p) => !data.players.some((active) => active.id === p.id))];
  const names = namesFor(players, data.seasons, match.seasonId ?? "");
  const events = [...(match.events ?? [])].sort((a, b) => (eventMinute(a) ?? Infinity) - (eventMinute(b) ?? Infinity));
  const lineup = (ids?: string[]) => ids?.length ? ids.map((id) => names(id)).join(" · ") : "Sin datos registrados";
  return <section className="det" aria-label="Partido archivado">
    <div className="dh">
      <button type="button" className="ib2" onClick={onBack} aria-label="Volver a la lista"><AdIcon name="back" /></button>
      <div className="tt"><small>Archivado · {season?.name ?? "Sin temporada"}</small><b role="heading" aria-level={2}>PITI {match.status === "finished" && match.goalsFor != null && match.goalsAgainst != null ? `${match.goalsFor}–${match.goalsAgainst}` : "–"} {match.rival || "Rival pendiente"}</b></div>
    </div>
    <div className="db archive-detail">
      <div className="rec2"><span><b>Acta archivada · solo lectura</b>No aparece en el calendario ni suma a las estadísticas. Conserva sus eventos, votos y porras{match.draft ? " y su borrador" : ""}.</span></div>
      <p className="hint">{matchIdentity(match)}</p>
      <dl className="archive-facts"><div><dt>Campo</dt><dd>{match.venue || "Sin campo registrado"}</dd></div><div><dt>Competición</dt><dd>{match.competition || "Sin competición registrada"}</dd></div><div><dt>Siete inicial</dt><dd>{lineup(match.starters)}</dd></div><div><dt>Banquillo</dt><dd>{lineup(match.bench)}</dd></div><div><dt>No convocados</dt><dd>{lineup(match.notCalled)}</dd></div></dl>
      <section aria-label="Eventos del acta archivada"><h3 className="ch3">Eventos · {events.length}</h3>
        {events.length ? <ol className="archive-events">{events.map((e) => <li key={e.id}><b>{eventMinute(e) == null ? "—" : `${eventMinute(e)}′`}</b><span><strong>{EVENT_LABELS[e.type] ?? e.type}</strong>{e.playerId ? ` · ${names(e.playerId)}` : ""}{e.inPlayerId ? ` → ${names(e.inPlayerId)}` : ""}{e.receiverId ? ` → ${names(e.receiverId)}` : ""}{e.assistPlayerId ? ` · asistencia de ${names(e.assistPlayerId)}` : ""}{e.note ? <small>{e.note}</small> : null}</span></li>)}</ol> : <p className="hint">Sin eventos registrados.</p>}
      </section>
      {match.report && <section aria-label="Crónica archivada"><h3 className="ch3">Crónica</h3><p className="archive-report">{match.report}</p></section>}
      <div className="danger"><p><b>Eliminar definitivamente</b>Se perderá el partido con todo su contenido. Esta acción no se puede deshacer.</p><button type="button" className="btn sm red" onClick={() => onLifecycle({ action: "delete", match })} aria-haspopup="dialog"><AdIcon name="trash" size={16} />Borrar partido</button></div>
    </div>
    <div className="df"><p className="hint" id={`restore-reason-${match.id}`}>{season?.archived ? `Reactiva primero ${season.name} desde Temporadas para recuperar este partido.` : match.published ? "Reactivar devuelve este partido al calendario y a las estadísticas." : "Reactivar recupera el borrador. Seguirá sin publicarse hasta que lo publiques."}</p><button type="button" className="btn sky" disabled={!!season?.archived} aria-describedby={`restore-reason-${match.id}`} aria-haspopup="dialog" onClick={() => onLifecycle({ action: "restore", match })}>Reactivar partido</button></div>
  </section>;
}
