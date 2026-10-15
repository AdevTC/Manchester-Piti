import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EVENT_LABELS, formatDate, type ClubMatch } from "../../lib/clubData";
import { OUTCOME_LABELS } from "../../../functions/src/matchAnalysis";
import { eventMinute } from "../../../functions/src/matchEngine";
import { TECH_LABELS } from "../../lib/technicalAnalysis";
import { technicalEvidence, type EvidenceSelection } from "../../lib/technicalEvidence";
import type { Person } from "./TechnicalStats";

/** Inline drilldown: native focus order, Escape closes, and focus returns to the original figure. */
export function TechnicalEvidence({ matches, people, selection, onClose }: {
  matches: readonly ClubMatch[]; people: Person[]; selection: EvidenceSelection; onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  const [limit, setLimit] = useState(30);
  const rows = useMemo(() => technicalEvidence(matches, selection), [matches, selection]);
  const names = new Map(people.map(p => [p.id, p.name]));
  const name = (id: string) => names.get(id) ?? "Jugador sin ficha";
  const subject = selection.playerId ? name(selection.playerId) : selection.side === "opponent" ? "El rival" : "El Piti";
  useEffect(() => { heading.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView?.({ block: "start" }); }, [selection]);
  return <section ref={panel} className="st-card ts-evidence" aria-labelledby={titleId} onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
    <div className="ts-title"><div><span className="hm-kick">De dónde sale la cifra</span><h3 ref={heading} tabIndex={-1} className="st-h3" id={titleId}>{TECH_LABELS[selection.metric]} · {subject}</h3></div><button className="hm-ghostbtn" type="button" onClick={onClose}>Cerrar detalle</button></div>
    <p className="st-mono">{rows.reduce((n, r) => n + r.contribution, 0)} {rows.reduce((n, r) => n + r.contribution, 0) === 1 ? "registrada" : "registradas"} · {rows.length} {rows.length === 1 ? "jugada" : "jugadas"} · {new Set(rows.map(r => r.match.id)).size} {new Set(rows.map(r => r.match.id)).size === 1 ? "partido" : "partidos"}{selection.receiverId ? ` · hacia ${name(selection.receiverId)}` : ""}. Solo se incluye la cobertura seleccionada.</p>
    {!rows.length && <p className="st-empty">No hay acciones registradas para esta cifra. Una cobertura parcial no permite afirmar que no ocurrieran.</p>}
    <ol className="ts-evidence-list">{rows.slice(0, limit).map(({ match, event, contribution }) => <li key={`${match.id}/${event.id}`}>
      <div className="ts-evidence-time">{eventMinute(event) == null ? "Sin minuto" : `${eventMinute(event)}′`}{event.elapsedSeconds != null && <small>{Math.floor(event.elapsedSeconds / 60)}:{String(event.elapsedSeconds % 60).padStart(2, "0")} de juego</small>}</div>
      <div><b>{EVENT_LABELS[event.type]}</b><p>{event.team === "opponent" || event.type.startsWith("opponent_") ? (event.opponentPlayer || "Rival") : event.playerId ? name(event.playerId) : "Autor sin identificar"}{event.receiverId ? ` → ${name(event.receiverId)}` : ""}{event.assistPlayerId ? ` · asistencia de ${name(event.assistPlayerId)}` : ""}{event.outcome ? ` · ${OUTCOME_LABELS[event.outcome]}` : ""}{contribution > 1 ? ` · +${contribution}` : ""}</p>
      {event.note && <p>{event.note}</p>}{event.sourceRef && <p className="st-mono">Origen: {event.sourceRef}</p>}
      <a href={`/matches/${encodeURIComponent(match.id)}?tab=estadisticas`}>{formatDate(match.date)} · {match.rival ?? "Rival"} · Ver acta</a></div>
    </li>)}</ol>
    {rows.length > limit && <button className="hm-ghostbtn" type="button" onClick={() => setLimit(n => n + 30)}>Ver 30 jugadas más ({rows.length - limit} pendientes)</button>}
  </section>;
}
