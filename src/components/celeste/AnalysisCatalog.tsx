import { useProgressiveLoad } from "../../hooks/useProgressiveLoad";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { NARRATED_METRICS, NARRATED_METRIC_BY_ID } from "../../../functions/src/narrated/catalog";
import type { MetricResult, NarratedMatch, ObservationKind } from "../../../functions/src/narrated/types";
import { EVENT_LABELS, formatDate, type ClubMatch } from "../../lib/clubData";
import type { AnalysisSearch } from "../../lib/analysisSearch";
import type { Person } from "./TechnicalStats";
import { eventSide, OUTCOME_LABELS } from "../../../functions/src/matchAnalysis";
import { metricValue } from "../../lib/metricDisplay";
import { METRIC_STATUS_LABELS as STATUS } from "../../lib/metricStatus";
import { MetricState } from "./MetricState";
export { MetricState } from "./MetricState";

const KIND: Record<ObservationKind, string> = { context: "Contexto", lineup: "Alineación", substitution: "Cambio", control: "Control", pass: "Pase", reception: "Recepción", dribble: "Regate", carry: "Conducción", duel: "Duelo", tackle: "Entrada", interception: "Intercepción", clearance: "Despeje", shot: "Remate", goal: "Gol", block: "Bloqueo", save: "Parada", keeper: "Acción del portero", distribution: "Distribución", pressure: "Presión", loss: "Pérdida", recovery: "Recuperación", attack: "Ataque", restart: "Reanudación", discipline: "Disciplina", tactical: "Acción táctica", run: "Desmarque", judgement: "Valoración", measurement: "Medición", gap: "Tramo sin información", aggregate: "Registro agregado" };
const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const norm = (text: string) => text.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const FAMILIES = [...new Set(NARRATED_METRICS.map(metric => metric.category))];

export function AnalysisCatalog({ matches, people, results, search, onChange }: { matches: readonly ClubMatch[]; people: Person[]; results: MetricResult[]; search: AnalysisSearch; onChange: (patch: Partial<AnalysisSearch>) => void }) {
  const uid = useId();
  const [limit, setLimit] = useState(24);
  const focusRef = useRef<HTMLHeadingElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const byId = useMemo(() => new Map(results.map(result => [result.id, result])), [results]);
  const selected = search.metric ? NARRATED_METRIC_BY_ID.get(search.metric) : undefined;
  const selectedResult = selected ? byId.get(selected.id) : undefined;
  const filtered = useMemo(() => NARRATED_METRICS.filter(metric => (search.excluded || metric.audio.viability !== "excluded") && (!search.family || metric.category === search.family) && (!search.q || norm(`${metric.id} ${metric.name} ${metric.category} ${metric.definition}`).includes(norm(search.q)))), [search.excluded, search.family, search.q]);
  useEffect(() => { if (selected) focusRef.current?.focus(); }, [selected]);
  const changeFilter = (patch: Partial<AnalysisSearch>) => { setLimit(24); onChange({ ...patch, metric: undefined }); };
  const sentinel = useProgressiveLoad(filtered.length > limit && !selected, [search.q, search.family, search.excluded, limit].join(":"), () => setLimit((value) => value + 24));
  const close = () => { onChange({ metric: undefined }); lastTrigger.current?.focus(); };
  return <div className="an-catalog">
    <header className="an-catalog__head"><div><h3>Una ficha para cada estadística</h3><p>{NARRATED_METRICS.length} definiciones. Las que necesitan vídeo, seguimiento u otra fuente se pueden consultar por separado.</p></div><details className="an-legend"><summary>Cómo leer los estados</summary><dl>{Object.entries(STATUS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{{ complete: "La información necesaria está completa para esta muestra.", partial: "Se cuenta lo registrado; faltan acciones o detalles.", unknown: "La narración no permite obtener un valor.", not_configured: "Falta fijar un criterio o un parámetro de cálculo.", not_applicable: "No corresponde a esta selección o requiere otra fuente.", no_sample: "No hay casos válidos para calcularlo; no equivale a cero." }[key]}</dd></div>)}</dl></details></header>
    <div className="an-catalog__filters"><label>Buscar estadística<input type="search" value={search.q ?? ""} onChange={event => changeFilter({ q: event.target.value || undefined })} placeholder="Pases, recuperaciones, minutos…"/></label><label>Familia<select value={search.family ?? ""} onChange={event => changeFilter({ family: event.target.value || undefined })}><option value="">Todas las familias</option>{FAMILIES.map(family => <option key={family}>{family}</option>)}</select></label><label className="an-toggle"><input type="checkbox" checked={!!search.excluded} onChange={event => changeFilter({ excluded: event.target.checked || undefined })}/>Incluir las {NARRATED_METRICS.filter(metric => metric.audio.viability === "excluded").length} fuera del audio</label></div>
    <p className="an-results" role="status">{filtered.length} estadísticas{search.family ? ` · ${search.family}` : ""}</p>
    <div className={`an-catalog__layout${selected ? " has-detail" : ""}`}>
      <div className="an-catalog__list"><ul aria-label="Estadísticas del catálogo">{filtered.slice(0, limit).map(metric => { const result = byId.get(metric.id); return <li key={metric.id}><button type="button" aria-pressed={selected?.id === metric.id} onClick={event => { lastTrigger.current = event.currentTarget; onChange({ metric: metric.id }); }}><span className="an-metric__text"><small>{metric.category}{metric.audio.viability === "excluded" ? " · Fuera del audio" : ""}</small><b>{metric.name}</b></span><span className="an-metric__value"><strong>{result ? metricValue(result) : "—"}</strong>{result && <MetricState status={result.status}/>}</span><span aria-hidden="true">↗</span></button></li>; })}</ul>{!filtered.length && <p className="an-empty">No hay estadísticas con estos filtros. Prueba otra búsqueda o familia.</p>}<div ref={sentinel}>{filtered.length > limit && <button type="button" className="an-more" onClick={() => setLimit(value => value + 24)}>Mostrar más ({Math.min(limit, filtered.length)} de {filtered.length})</button>}</div></div>
      {selected && selectedResult && <section className="an-detail" aria-labelledby={`${uid}-detail`} onKeyDown={event => { if (event.key === "Escape") close(); }}>
        <header><span className="an-eyebrow">{selected.category} · {selected.id}</span><button type="button" aria-label="Cerrar detalle de la estadística" onClick={close}>Cerrar ×</button></header>
        <h3 id={`${uid}-detail`} tabIndex={-1} ref={focusRef}>{selected.name}</h3>
        <div className="an-detail__value"><strong>{metricValue(selectedResult)}</strong><MetricState status={selectedResult.status}/></div>
        <p>{selectedResult.reason}</p>
        <dl className="an-sample"><div><dt>Observaciones válidas</dt><dd>{selectedResult.observed}</dd></div><div><dt>Pendientes</dt><dd>{selectedResult.pending}</dd></div>{selectedResult.numerator != null && <div><dt>Numerador</dt><dd>{number.format(selectedResult.numerator)}</dd></div>}{selectedResult.denominator != null && <div><dt>Denominador</dt><dd>{number.format(selectedResult.denominator)}</dd></div>}{selectedResult.exposureSeconds != null && <div><dt>Tiempo computable</dt><dd>{number.format(selectedResult.exposureSeconds / 60)} min</dd></div>}</dl>
        <h4>Qué mide y cómo se calcula</h4><p>{selected.definition}</p><p>{selected.audio.extraction}</p>
        <dl className="an-method"><div><dt>Ámbito</dt><dd>{selected.scope}</dd></div><div><dt>Regla aplicada</dt><dd>{selectedResult.ruleId} · versión {selectedResult.ruleVersion}</dd></div><div><dt>Contexto de fútbol 7</dt><dd>{selected.football7Note}</dd></div></dl>
        <h4>Qué debe constar en la narración</h4><p>{selected.audio.whatToNarrate}</p><p>{selected.audio.condition || selected.audio.evidence}</p>
        {selected.audio.viability === "excluded" && <p className="an-note"><b>Fuera del audio.</b> {selected.audio.condition || selected.audio.evidence}</p>}
        <MetricEvidence key={`${selected.id}:${selectedResult.evidenceEventIds.join("|")}`} result={selectedResult} matches={matches} people={people} search={search}/>
        <details className="an-method-more"><summary>Criterios y parámetros de este cálculo</summary><p>{selected.method}</p><p>Reglas relacionadas: {selected.ruleIds.join(", ") || "Sin reglas adicionales"}.</p>{Object.keys(selectedResult.parameters).length > 0 && <dl>{Object.entries(selectedResult.parameters).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>)}</dl>}<p>Fuente del catálogo: {selected.source.sheet}, fila {selected.source.row}.</p></details>
      </section>}
    </div>
  </div>;
}

function MetricEvidence({ result, matches, people }: { result: MetricResult; matches: readonly ClubMatch[]; people: Person[]; search: AnalysisSearch }) {
  const [limit, setLimit] = useState(20);
  const names = new Map(people.map(person => [person.id, person.name]));
  const rows = result.evidenceEventIds.map(id => {
    const match = matches.find(item => id.startsWith(`${item.id}:`));
    if (!match) return null;
    const eventId = id.slice(match.id.length + 1);
    const observation = (match as NarratedMatch).analysis?.observations.find(item => item.id === eventId);
    const event = match.events?.find(item => item.id === eventId || item.id === observation?.canonicalEventId);
    const playerId = observation?.actorId ?? event?.playerId;
    const receiverId = observation?.receiverId ?? event?.receiverId;
    const stamp = (seconds: number) => `${Math.floor(seconds / 60)}′ ${Math.floor(seconds % 60)}″`;
    const time = observation?.time ? `${observation.time.precision === "approximate" ? "≈ " : ""}${stamp(observation.time.from)}${observation.time.precision === "interval" ? `–${stamp(observation.time.to)}` : ""}` : event && !event.timingUnknown && typeof event.minute === "number" ? `${event.minute}′` : "Sin tiempo preciso";
    const origins = Object.values(observation?.provenance ?? {});
    const origin = origins.some(value => value.kind === "judgement") ? "Valoración narrada" : origins.some(value => value.kind === "deduced") ? "Deducida por una regla" : undefined;
    const outcome = observation?.facts.outcome ?? event?.outcome;
    const outcomeLabel = typeof outcome === "string" ? OUTCOME_LABELS[outcome as keyof typeof OUTCOME_LABELS] : undefined;
    return { id, match, label: observation ? KIND[observation.kind] : event ? EVENT_LABELS[event.type] ?? "Jugada" : "Registro del acta", player: playerId ? names.get(playerId) ?? "Jugador no identificado" : observation?.team === "opponent" || (event && eventSide(event) === "opponent") ? "El rival" : "El equipo", receiver: receiverId ? names.get(receiverId) ?? "Receptor no identificado" : undefined, time, origin, outcomeLabel, note: event?.note };
  }).filter(row => row != null);
  return <section className="an-evidence" aria-label="Jugadas que sustentan la estadística"><h4>Jugadas y registros ({result.evidenceEventIds.length})</h4>{!rows.length ? <p>Este cálculo no enlaza jugadas individuales{result.value != null ? ": puede proceder de la participación o del contexto del acta" : "; consulta arriba los datos necesarios"}.</p> : <ol>{rows.slice(0, limit).map(row => <li key={row.id}><span className="an-evidence__time">{row.time}</span><div><b>{row.label} · {row.player}{row.receiver ? ` → ${row.receiver}` : ""}</b>{(row.origin || row.outcomeLabel) && <small>{[row.outcomeLabel, row.origin].filter(Boolean).join(" · ")}</small>}{row.note && <small>{row.note}</small>}<Link to="/partidos/$matchId/numeros" params={{ matchId: row.match.id }} search={{}}>{formatDate(row.match.date)} · {row.match.rival ?? "Rival"} ↗</Link></div></li>)}</ol>}{rows.length > limit && <button type="button" onClick={() => setLimit(value => value + 20)}>Ver más jugadas ({limit} de {rows.length})</button>}</section>;
}
