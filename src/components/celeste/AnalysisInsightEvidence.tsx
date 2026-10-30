import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DEFAULT_ANALYSIS_PROFILE, type AnalysisFilters, type MetricResult } from "../../../functions/src/narrated/types";
import { isGoal, isPass, passComplete } from "../../../functions/src/narrated/operators";
import { insightEvidence } from "../../lib/analysisInsights";
import { workspaceMetricValue, type WorkspacePerson } from "../../lib/analysisWorkspace";
import { formatDate, type ClubMatch } from "../../lib/clubData";
import { chartClock as clock } from "./charts/format";
import "./analysis-insights.css";

const LABELS: Record<string, string> = { pass: "Pase", distribution: "Distribución", shot: "Remate", goal: "Gol", loss: "Pérdida", recovery: "Recuperación" };
const OUTCOMES: Record<string, string> = { complete: "Completado", completed: "Completado", success: "Completado", failed: "Fallido", incomplete: "Fallido", intercepted: "Interceptado", saved: "Parado", off_target: "Fuera", on_target: "A puerta", blocked: "Bloqueado", woodwork: "Al palo" };

/** The plays behind a chart selection, each one linked to its match. */
export function AnalysisInsightEvidence({ matches, people, result }: { matches: readonly ClubMatch[]; people: readonly WorkspacePerson[]; filters: AnalysisFilters; result: MetricResult }) {
  const [limit, setLimit] = useState(12);
  const rows = useMemo(() => insightEvidence(matches, result.evidenceEventIds), [matches, result.evidenceEventIds]);
  const names = new Map(people.map(person => [person.id, person.name]));
  const games = new Map(matches.map(match => [match.id, match]));
  return <div className="ai-evidence"><h5>Jugadas de esta muestra ({rows.length})</h5>{!rows.length ? <p className="gc-note">{workspaceMetricValue(result) === 0 ? "La cobertura respalda este cero; no hay jugadas que listar." : "No hay jugadas atribuibles con suficiente precisión en esta muestra."}</p> : <ol>{rows.slice(0, limit).map(event => {
    const match = games.get(event.matchId); const actor = event.team === "opponent" ? event.opponentId : event.actorId; const destination = event.team === "opponent" ? String(event.facts.opponentReceiverId ?? "") : event.receiverId ?? event.intendedReceiverId;
    const name = (id: string) => event.team === "opponent" ? names.get(JSON.stringify([event.matchId, id])) ?? names.get(id) : names.get(id);
    const profile = match?.analysis?.profile ?? DEFAULT_ANALYSIS_PROFILE;
    const completion = isPass(event, profile) ? passComplete(event, profile) : undefined;
    const outcome = isGoal(event) ? event.facts.ownGoal === true ? "Gol en propia puerta" : "Gol" : completion === true ? "Completado" : completion === false ? "Fallido" : OUTCOMES[String(event.facts.outcome)] ?? "Resultado sin precisar";
    return <li key={event.evidenceId}><span className="ai-event-time">{event.period ? `${event.period}.ª · ` : ""}{event.time ? `${event.time.precision === "approximate" ? "≈" : ""}${clock(event.time.from)}${event.time.to !== event.time.from ? `–${clock(event.time.to)}` : ""}` : "Sin minuto"}</span><div><b>{LABELS[event.aggregate?.kind ?? event.kind] ?? "Jugada"} · {actor ? name(actor) ?? "Jugador no identificado" : event.team === "opponent" ? "El rival" : "El Piti"}{destination ? ` → ${name(destination) ?? "Receptor no identificado"}` : ""}</b><small>{outcome}{event.quantity && event.quantity > 1 ? ` · ${event.quantity} acciones agrupadas` : ""}</small>{match && <Link to="/partidos/$matchId/numeros" params={{ matchId: match.id }} search={{}}>Abrir partido · {formatDate(match.date)} · {match.rival ?? "Rival"} ↗</Link>}</div></li>;
  })}</ol>}{rows.length > limit && <div className="gc-actions"><button type="button" className="vd-glass vd-btn vd-press ai-btn" onClick={() => setLimit(previous => previous + 12)}>Ver más jugadas ({limit}/{rows.length})</button></div>}</div>;
}
