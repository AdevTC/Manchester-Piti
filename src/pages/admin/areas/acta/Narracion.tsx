// ACTA · the narrated analysis (/admin/partidos/<id>/acta/narracion), out of the acta into its own screen (A-PAR-01,
// B-ACTA-03), as its board (part-partido-acta.html § narración): left, the coverage (Parcial · Completa), the real
// playing time said aloud against the match's duration with «Ajustar la duración del partido» (A-PAR-02: one datum,
// never changed behind the captain's back), the coverage notes, «Importar una narración» (copy the prompt and the
// context, a .json up to 900 KB or pasted, «Revisar importación» → the review with its doubts, «Incorporar al
// borrador»), the coverage rules and the working sources, the private history; right, the observations of the
// analysis (filters, edit in its row, «Borrar» with «Deshacer») and the acta's actions (filter, 30 a page, «Añadir
// acción» with its form, «Quitar» with «Deshacer»). Everything edits the same acta buffer as «Lo apuntado»: it is
// saved with the acta. The narration's logic is today's (lib/narration, functions/src/narrated).
import { useEffect, useMemo, useRef, useState } from "react";
import { ACTION_LABELS, OUTCOME_LABELS, actionProblem, isAnalysisAction, type Outcome } from "../../../../../functions/src/matchAnalysis";
import { EVENT_LABELS, type MatchEvent, type MatchSheet } from "../../../../../functions/src/matchEngine";
import { eventSchema } from "../../../../../functions/src/eventSchema";
import type { Observation } from "../../../../../functions/src/narrated/types";
import { analysisProblem } from "../../../../../functions/src/narrated/schema";
import { addNarratedObservation, editNarratedObservation, emptyNarratedAnalysis, removeNarratedObservation } from "../../../../../functions/src/narrated/editing";
import { correctNarrationEvent, correctNarrationObservation, narrationContext, previewNarration, resolveNarrationQuestion } from "../../../../lib/narration";
import { newId, removeEvent, restoreEvent, sig, upsertEvent } from "../../acta/sheetModel";
import { AnalysisSettings } from "../../partidos/AnalysisSettings";
import { NarratedObservations } from "../../partidos/NarratedObservations";
import { NarrationHistory } from "../../partidos/NarrationHistory";
import { NarrationReview } from "../../partidos/NarrationReview";
import { usePartido } from "../../partido/partidoContext";
import { ScreenLoading } from "../../shell/Screen";
import { useStatus } from "../../shell/statusContext";
import { ActaNav } from "./parts";
import { useSheetSession, type SheetSession } from "./sheetSession";
import "../../partidos/analysis-editor.css";
import "./acta.css";

export function NarracionScreen() {
  const s = useSheetSession();
  if (s.loading) return <ScreenLoading label="Cargando el análisis" />;
  return (
    <section className="ac ac-acta" aria-label="El análisis narrado">
      <ActaNav on="narracion" />
      <Narration s={s} />
    </section>
  );
}

function Narration({ s }: { s: SheetSession }) {
  const { match } = usePartido();
  const status = useStatus();
  const matchId = match.id;
  const sheet = s.sheet;
  const update = s.update;
  const info = (id: string) => ({ name: s.info(id).name, number: s.info(id).number });
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [context, setContext] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof previewNarration> | null>(null);
  const [event, setEvent] = useState<MatchEvent | null>(null);
  const [importEditing, setImportEditing] = useState(false);
  const eventForm = useRef<HTMLDivElement>(null);
  const eventBaseline = useRef<string | undefined>(undefined);
  const editEventId = event?.id;
  useEffect(() => {
    if (editEventId) {
      eventForm.current?.focus();
      eventForm.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [editEventId]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const roster = [...sheet.starters, ...sheet.bench].map((id) => ({ id, ...info(id) }));
  const actions = useMemo(() => sheet.events.filter((e) => isAnalysisAction(e.type)), [sheet.events]);
  const list = useMemo(() => actions.filter((e) => !filter || e.type === filter), [actions, filter]);
  const pages = Math.max(1, Math.ceil(list.length / 30));
  const at = Math.min(page, pages - 1);
  const set = (patch: Partial<MatchEvent>) => setEvent((e) => (e ? { ...e, ...patch } : e));
  const changeType = (type: MatchEvent["type"]) =>
    setEvent((e) =>
      e
        ? {
            ...e,
            type,
            outcome: isAnalysisAction(type) ? "unknown" : undefined,
            team: type.startsWith("opponent_") ? "opponent" : isAnalysisAction(type) ? e.team : "us",
            ...(type.startsWith("opponent_") ? { playerId: undefined } : {}),
            receiverId: undefined,
            keyPass: undefined,
            assistPlayerId: undefined,
            assistReviewed: undefined,
            inPlayerId: undefined,
            possessionSeconds: undefined,
          }
        : e,
    );
  const say = (m: string) => setMessage(m);
  const trySave = () => {
    if (!event) return;
    const parsed = eventSchema.safeParse(Object.fromEntries(Object.entries(event).filter(([, v]) => v !== undefined && v !== "")));
    const why = parsed.success ? actionProblem(parsed.data) : parsed.error.issues.map((i) => i.message).join(" ");
    if (why || !parsed.success) return say(why ?? "Revisa la jugada.");
    if (parsed.data.minute == null && !parsed.data.timingUnknown) return say("Indica el minuto o marca que no se conoce.");
    if (importEditing) {
      try {
        const corrected = correctNarrationEvent(text, parsed.data);
        setText(corrected);
        setPreview(previewNarration(corrected, matchId, sheet));
        setEvent(null);
        setImportEditing(false);
        say("Acción corregida en la importación. El acta aún no ha cambiado.");
      } catch (e) {
        say((e as Error).message);
      }
      return;
    }
    if (eventBaseline.current !== JSON.stringify(sheet.events.find((e) => e.id === event.id))) return say("Esta acción ha cambiado mientras la editabas. Conservamos tus campos: cancela y abre la versión actual antes de guardar.");
    update((v) => upsertEvent(v, parsed.data));
    setEvent(null);
    status.show({ tag: "Acción", message: `${eventBaseline.current ? "Corregida" : "Apuntada"}: ${EVENT_LABELS[parsed.data.type] ?? "acción"}${parsed.data.minute != null ? ` · ${parsed.data.minute}′` : " · sin minuto"}` });
    say("");
  };
  const importPreview = () => {
    try {
      setPreview(previewNarration(text, matchId, sheet));
      say("");
    } catch (e) {
      setPreview(null);
      say((e as Error).message);
    }
  };
  const apply = () => {
    if (event) return say("Guarda o cancela la acción que estás editando antes de incorporar la importación.");
    try {
      const fresh = previewNarration(text, matchId, sheet);
      if (fresh.errors.length) return setPreview(fresh);
      if (preview?.baseFingerprint !== fresh.baseFingerprint) {
        setPreview(fresh);
        return say("El borrador ha cambiado durante la revisión. Comprueba la comparación actualizada antes de incorporarla.");
      }
      update(() => fresh.sheet);
      setPreview(null);
      setText("");
      setFileName("");
      status.show({ tag: "Importación", message: "Análisis incorporado al borrador · se guarda con el acta" });
      say("");
    } catch (e) {
      say((e as Error).message);
    }
  };
  const resolve = (index: number, resolution: string) => {
    try {
      const corrected = resolveNarrationQuestion(text, index, resolution);
      setPreview(previewNarration(corrected, matchId, sheet));
      setText(corrected);
      say("Resolución guardada en la revisión. Comprueba las acciones antes de incorporarlas.");
    } catch (e) {
      say((e as Error).message);
    }
  };
  const editObservation = (o: Observation) => {
    const corrected = correctNarrationObservation(text, o, sheet.events);
    setText(corrected);
    setPreview(previewNarration(corrected, matchId, sheet));
    say("Detalle corregido en la importación. El acta aún no ha cambiado.");
  };
  const ids = [...sheet.starters, ...sheet.bench, ...sheet.notCalled];
  const seconds = sheet.durationSeconds ?? sheet.duration * 60;
  const validate = (next: MatchSheet) => {
    const problem = analysisProblem(next.analysis, next.events, ids, seconds);
    if (problem) throw new Error(problem);
    update(() => next);
  };
  const saveObservation = (o: Observation) => {
    if (!sheet.analysis) return;
    validate(editNarratedObservation(sheet, o));
    status.show({ tag: "Detalle", message: "Detalle y acción vinculada corregidos · se guardan con el acta" });
  };
  const addObservation = (o: Observation) => {
    validate(addNarratedObservation(sheet, o));
    status.show({ tag: "Detalle", message: "Detalle añadido al borrador" });
  };
  const removeObservation = (id: string) => {
    const before = sheet;
    const next = removeNarratedObservation(sheet, id);
    validate(next);
    // (its linked action goes with it; «Deshacer» brings both back while nothing else changed)
    status.show({ tag: "Detalle", message: "Detalle borrado del borrador junto a su acción vinculada, si la tenía", undo: () => update((v) => (sig(v.analysis) === sig(next.analysis) && sig(v.events) === sig(next.events) ? { ...v, events: before.events, ...(before.analysis ? { analysis: before.analysis } : {}) } : v)) });
  };
  const dropAction = (e: MatchEvent) => {
    const before = s.value;
    update((v) => removeEvent(v, e.id));
    status.show({ tag: "Acción", message: `${EVENT_LABELS[e.type] ?? "Acción"} quitada${(before.analysis?.observations ?? []).some((o) => o.canonicalEventId === e.id) ? " · y su detalle narrado" : ""}`, undo: () => update((v) => restoreEvent(v, before, e.id)) });
  };
  const copy = async () => {
    const value = narrationContext(matchId, sheet, roster);
    setContext(value);
    try {
      await navigator.clipboard.writeText(value);
      status.show({ tag: "Copiado", message: `Prompt y contexto de la ${s.j} en el portapapeles: pégalo en tu chat con el asistente` });
    } catch {
      say("Puedes seleccionar y copiar el contexto que aparece debajo.");
    }
  };
  const players = (value: string | undefined, setter: (id: string | undefined) => void, label: string) => (
    <label className="sc-field">
      <span>{label}</span>
      <select className="vd-input" value={value ?? ""} onChange={(e) => setter(e.target.value || undefined)}>
        <option value="">Sin identificar</option>
        {roster.map((p) => (
          <option value={p.id} key={p.id}>
            {p.number ?? "—"} · {p.name}
          </option>
        ))}
      </select>
    </label>
  );

  // ── the real playing time, said aloud (A-PAR-02) ──
  const secs = sheet.durationSeconds;
  const newDur = secs ? Math.ceil(secs / 60) : null;
  const durLine = secs
    ? newDur === sheet.duration
      ? `Y la duración del partido sigue en ${sheet.duration} min (la de «Datos»): es el mismo dato, redondeado al minuto.`
      : `Ojo: la duración del partido es ${sheet.duration} min (la de «Datos») y el juego real redondea a ${newDur} min. «Ajustar la duración del partido» la pone igual.`
    : `La duración del partido es ${sheet.duration} min (la de «Datos»); si apuntas la real, se puede ajustar a ella.`;
  const coverage = sheet.analysisCoverage ?? "partial";

  return (
    <div className="ac-narr">
      <div className="ac-narr__col">
        <header className="ac-narr__h">
          <h2 className="sc-h2">Análisis narrado · {s.j}</h2>
          <p className="sc-p">Herramienta de experto: el partido acción a acción tal como lo cuenta la narración. El acta de cada domingo (goles, tarjetas, cambios) está en «Lo apuntado».</p>
        </header>

        <section className="sc-sec ac-sec" aria-labelledby="ac-cov-t">
          <h3 className="sc-h3" id="ac-cov-t">
            Cobertura
          </h3>
          <div className="ac-fieldrow">
            <p className="ac-lbl" id="ac-cov-l">
              Cobertura del análisis
            </p>
            <div className="vd-seg vd-glass ac-seg ac-seg--2" role="group" aria-labelledby="ac-cov-l">
              <button type="button" className="vd-seg__b" aria-pressed={coverage !== "complete"} onClick={() => update((v) => ({ ...v, analysisCoverage: "partial" }))}>
                Parcial
              </button>
              <button type="button" className="vd-seg__b" aria-pressed={coverage === "complete"} onClick={() => update((v) => ({ ...v, analysisCoverage: "complete" }))}>
                Completa
              </button>
            </div>
            <p className="sc-small">{coverage === "complete" ? "Completa · se ha revisado todo el partido" : "Parcial · solo acciones registradas"}</p>
          </div>
          <div className="sc-form">
            <label className="sc-field">
              <span>Duración real de juego (segundos, sin descanso)</span>
              <input
                className="vd-input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={secs ?? ""}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                  const n = Number(d);
                  update((v) => {
                    if (!d) {
                      const { durationSeconds: _gone, ...rest } = v;
                      void _gone;
                      return rest;
                    }
                    return n >= 1 && n <= 9000 ? { ...v, durationSeconds: n } : v;
                  });
                }}
              />
              <small>{secs ? `${Math.floor(secs / 60)} min ${secs % 60} s de juego, sin el descanso.` : "Sin apuntar."}</small>
            </label>
          </div>
          <p className="ac-say" role="status">
            {durLine}
          </p>
          {secs && newDur !== sheet.duration && (
            <button
              type="button"
              className="vd-btn vd-glass vd-press vd-btn--sm"
              onClick={() => {
                update((v) => ({ ...v, duration: Math.max(1, Math.min(150, newDur ?? v.duration)) }));
                status.show({ tag: "Duración", message: `La ${s.j} dura ${newDur} min · la real, ${Math.floor(secs / 60)} min ${secs % 60} s` });
              }}
            >
              Ajustar la duración del partido
            </button>
          )}
          <label className="sc-field ac-wide">
            <span>Notas de cobertura</span>
            <textarea className="vd-input" maxLength={2000} value={sheet.analysisNotes ?? ""} onChange={(e) => update((v) => ({ ...v, analysisNotes: e.target.value.slice(0, 2000) }))} placeholder="Ej.: faltan las acciones de los primeros cinco minutos." />
            <small>{(sheet.analysisNotes ?? "").length} de 2000</small>
          </label>
        </section>

        <section className="sc-sec ac-sec" aria-labelledby="ac-imp-t">
          <h3 className="sc-h3" id="ac-imp-t">
            Importar una narración
          </h3>
          <p className="sc-small">Entrega el audio o dicta el partido en tu chat con el asistente y trae aquí el resultado: se revisa antes de entrar en el borrador; las acciones de antes se conservan.</p>
          <div className="sc-btnrow">
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void copy()}>
              Copiar prompt y contexto
            </button>
          </div>
          {context && (
            <label className="sc-field ac-wide">
              <span>Contexto del partido (solo lectura)</span>
              <textarea className="vd-input" readOnly value={context} rows={6} onFocus={(e) => e.target.select()} />
            </label>
          )}
          <div className="sc-form ac-wide">
            <label className="sc-field">
              <span>Archivo de acciones (.json, hasta 900 KB)</span>
              <input
                className="vd-input ac-file"
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 900_000) return status.show({ tone: "error", message: "Archivo demasiado grande (máximo 900 KB)." });
                  void f.text().then((v) => {
                    setText(v);
                    setFileName(f.name);
                    setPreview(null);
                  });
                }}
              />
              {fileName && <small className="is-ok">{fileName} · listo para revisar</small>}
            </label>
            <label className="sc-field sc-field--wide">
              <span>O pega el análisis estructurado</span>
              <textarea
                className="vd-input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setPreview(null);
                }}
                placeholder="Pega aquí el análisis JSON generado en el chat"
              />
            </label>
          </div>
          <div className="sc-btnrow">
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={importPreview} aria-disabled={!text.trim() || undefined}>
              Revisar importación
            </button>
          </div>
          {preview && (
            <div className="ac-imp" role="region" aria-label="Revisión de la importación">
              <NarrationReview
                preview={preview}
                info={info}
                onEdit={(e) => {
                  setImportEditing(true);
                  setEvent({ ...e });
                }}
                onResolve={resolve}
                onEditObservation={editObservation}
                onApply={apply}
                editing={!!event}
              />
              <div className="sc-btnrow">
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setPreview(null)}>
                  Cancelar la importación
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="sc-sec ac-sec ac-rules" aria-labelledby="ac-rules-t">
          <h3 className="sc-h3" id="ac-rules-t">
            Reglas de cobertura
          </h3>
          <AnalysisSettings
            analysis={sheet.analysis ?? emptyNarratedAnalysis()}
            onSave={(analysis) => {
              validate({ ...sheet, analysis });
              status.show({ tag: "Cobertura", message: "Cobertura y reglas guardadas en el borrador" });
            }}
            sources={sheet.narrationSources ?? []}
            onSources={(sources) => update((v) => ({ ...v, narrationSources: sources }))}
          />
          <NarrationHistory
            key={matchId}
            matchId={matchId}
            onUseSources={(sources) => {
              update((v) => ({ ...v, narrationSources: sources }));
              status.show({ tag: "Fuentes", message: "Fuentes históricas cargadas como versión de trabajo · el original sigue en el historial" });
            }}
          />
        </section>
      </div>

      <div className="ac-narr__col">
        <section className="sc-sec ac-sec ac-obsec" aria-label="Observaciones del análisis">
          <NarratedObservations
            observations={sheet.analysis?.observations ?? []}
            nameOf={(id) => info(id).name}
            roster={roster}
            onSave={saveObservation}
            onAdd={addObservation}
            onRemove={removeObservation}
            onReorder={(observations) => validate({ ...sheet, analysis: { ...(sheet.analysis ?? emptyNarratedAnalysis()), observations } })}
            sources={sheet.narrationSources}
            issues={sheet.analysis?.issues}
            onResolveIssue={(id, resolution) => update((v) => ({ ...v, analysis: v.analysis ? { ...v.analysis, issues: v.analysis.issues?.map((q) => (q.id === id ? { ...q, resolved: resolution } : q)) } : undefined }))}
          />
          {!(sheet.analysis?.observations ?? []).length && <p className="ac-none">Sin análisis narrado. Importa una narración para tener el partido acción a acción.</p>}
        </section>

        <section className="sc-sec ac-sec" aria-labelledby="ac-acts-t">
          <header className="sc-sec__h">
            <h3 className="sc-h3" id="ac-acts-t">
              Las acciones del acta
            </h3>
            <span className="sc-sec__n">{list.length}</span>
            <button
              type="button"
              className="vd-btn vd-glass vd-press vd-btn--sm"
              onClick={() => {
                setImportEditing(false);
                eventBaseline.current = undefined;
                setEvent({ id: newId(), type: "pass", team: "us", outcome: "complete", source: "manual" });
              }}
            >
              Añadir acción
            </button>
          </header>
          <label className="sc-field ac-narrow">
            <span>Filtrar acciones</span>
            <select
              className="vd-input"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas ({actions.length})</option>
              {Object.entries(ACTION_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {event && (
            <div ref={eventForm} tabIndex={-1} className="ac-ed vd-glass vd-glass--deep" role="group" aria-label="Editar acción detallada">
              {importEditing && (
                <p className="sc-small">
                  <b>Corrigiendo la importación.</b> Guardar aquí conserva el cambio para su revisión; todavía no modifica el acta.
                </p>
              )}
              <div className="sc-form">
                <label className="sc-field">
                  <span>Acción</span>
                  <select className="vd-input" value={event.type} onChange={(e) => changeType(e.target.value as MatchEvent["type"])}>
                    {Object.entries(importEditing ? EVENT_LABELS : ACTION_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sc-field">
                  <span>Equipo</span>
                  <select className="vd-input" value={event.team ?? "us"} onChange={(e) => set({ team: e.target.value as "us" | "opponent", playerId: undefined, receiverId: undefined })}>
                    <option value="us">Manchester Piti</option>
                    <option value="opponent">Rival</option>
                  </select>
                </label>
                <label className="sc-field">
                  <span>Minuto (0–150)</span>
                  <input className="vd-input" type="number" min="0" max="150" disabled={event.timingUnknown} value={event.minute ?? ""} onChange={(e) => set({ minute: e.target.value === "" ? undefined : Number(e.target.value), elapsedSeconds: undefined })} />
                </label>
                <label className="sc-field">
                  <span>Segundo del minuto</span>
                  <input className="vd-input" type="number" min="0" max="59" disabled={event.timingUnknown || event.minute == null} value={event.elapsedSeconds != null ? event.elapsedSeconds % 60 : ""} onChange={(e) => set({ elapsedSeconds: e.target.value === "" ? undefined : (event.minute ?? 0) * 60 + Number(e.target.value) })} />
                </label>
                <label className="sc-field ac-check-f">
                  <span>Minuto desconocido</span>
                  <span className="ac-checkline">
                    <input type="checkbox" checked={!!event.timingUnknown} onChange={(e) => set({ timingUnknown: e.target.checked, ...(e.target.checked ? { minute: undefined, elapsedSeconds: undefined } : {}) })} />
                    No se conoce el minuto
                  </span>
                </label>
                {event.team !== "opponent" ? (
                  <>
                    {players(event.playerId, (id) => set({ playerId: id }), "Autor")}
                    {["pass", "cross", "throw_in", "goal_kick", "kickoff"].includes(event.type) && players(event.receiverId, (id) => set({ receiverId: id }), "Receptor")}
                  </>
                ) : (
                  <label className="sc-field">
                    <span>Jugador rival (opcional)</span>
                    <input className="vd-input" value={event.opponentPlayer ?? ""} onChange={(e) => set({ opponentPlayer: e.target.value })} />
                  </label>
                )}
                {["goal", "goal_penalty", "goal_freekick"].includes(event.type) && (
                  <>
                    {players(event.assistPlayerId, (id) => set({ assistPlayerId: id, assistReviewed: true }), "Asistente")}
                    <label className="sc-field ac-check-f">
                      <span>Asistencia</span>
                      <span className="ac-checkline">
                        <input type="checkbox" checked={!!event.assistReviewed} onChange={(e) => set({ assistReviewed: e.target.checked })} />
                        Asistencia revisada (sin asistente si no se elige jugador)
                      </span>
                    </label>
                  </>
                )}
                {event.type === "substitution" && players(event.inPlayerId, (id) => set({ inPlayerId: id }), "Jugador que entra")}
                {event.type === "position_swap" && players(event.inPlayerId, (id) => set({ inPlayerId: id }), "Se cambia el sitio con")}
                <label className="sc-field">
                  <span>Resultado</span>
                  <select className="vd-input" value={event.outcome ?? "unknown"} onChange={(e) => set({ outcome: e.target.value as Outcome, ...(e.target.value === "incomplete" ? { receiverId: undefined, keyPass: false } : {}) })}>
                    {Object.entries(OUTCOME_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sc-field">
                  <span>Zona</span>
                  <select className="vd-input" value={event.zone ?? ""} onChange={(e) => set({ zone: (e.target.value as MatchEvent["zone"]) || undefined })}>
                    <option value="">Sin precisar</option>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </label>
                <label className="sc-field ac-check-f">
                  <span>Pase clave</span>
                  <span className="ac-checkline">
                    <input type="checkbox" checked={!!event.keyPass} onChange={(e) => set({ keyPass: e.target.checked })} />
                    Pase clave · acaba en remate
                  </span>
                </label>
                <label className="sc-field sc-field--wide">
                  <span>Nota de la acción</span>
                  <input className="vd-input" type="text" maxLength={300} value={event.note ?? ""} onChange={(e) => set({ note: e.target.value })} />
                </label>
              </div>
              <details className="ac-more">
                <summary>Más detalle: envío, contacto, posesión, coordenadas y origen</summary>
                <div className="sc-form">
                  <label className="sc-field">
                    <span>Tipo de envío</span>
                    <select className="vd-input" value={event.delivery ?? ""} onChange={(e) => set({ delivery: (e.target.value as MatchEvent["delivery"]) || undefined })}>
                      <option value="">Sin precisar</option>
                      <option value="short">Corto</option>
                      <option value="long">Largo</option>
                      <option value="cross">Centro</option>
                      <option value="through">Al espacio</option>
                      <option value="throw">Con la mano</option>
                    </select>
                  </label>
                  <label className="sc-field">
                    <span>Contacto</span>
                    <select className="vd-input" value={event.bodyPart ?? ""} onChange={(e) => set({ bodyPart: (e.target.value as MatchEvent["bodyPart"]) || undefined })}>
                      <option value="">Sin precisar</option>
                      <option value="left">Pie izquierdo</option>
                      <option value="right">Pie derecho</option>
                      <option value="head">Cabeza</option>
                      <option value="hand">Mano</option>
                      <option value="other">Otro</option>
                    </select>
                  </label>
                  {event.type === "possession" && (
                    <label className="sc-field">
                      <span>Segundos de posesión</span>
                      <input className="vd-input" type="number" min="1" max="9000" value={event.possessionSeconds ?? ""} onChange={(e) => set({ possessionSeconds: Number(e.target.value) })} />
                    </label>
                  )}
                  {(["x", "y", "endX", "endY"] as const).map((k) => (
                    <label key={k} className="sc-field">
                      <span>Coordenada {k} (0–100)</span>
                      <input className="vd-input" type="number" min="0" max="100" value={event[k] ?? ""} onChange={(e) => set({ [k]: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    </label>
                  ))}
                  <label className="sc-field sc-field--wide">
                    <span>Fragmento o referencia de origen</span>
                    <input className="vd-input" value={event.sourceRef ?? ""} maxLength={160} onChange={(e) => set({ sourceRef: e.target.value || undefined })} />
                  </label>
                </div>
              </details>
              {message && (
                <p className="ac-err" role="alert">
                  {message}
                </p>
              )}
              <div className="sc-btnrow">
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" onClick={trySave}>
                  Guardar acción
                </button>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setEvent(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {!list.length && <p className="ac-none">{actions.length ? "Ninguna acción de ese tipo." : "Sin acciones: «Añadir acción» o importa una narración."}</p>}
          {list.length > 0 && (
            <ol className="sc-rows ac-acts">
              {list.slice(at * 30, at * 30 + 30).map((e) => (
                <li key={e.id} className="sc-row ac-act">
                  <span className="ac-play__m">{e.minute == null ? "—" : `${e.minute}′${e.elapsedSeconds != null ? String(e.elapsedSeconds % 60).padStart(2, "0") : ""}`}</span>
                  <button
                    type="button"
                    className="ac-act__b"
                    onClick={() => {
                      setImportEditing(false);
                      eventBaseline.current = JSON.stringify(e);
                      setEvent({ ...e });
                    }}
                  >
                    <b>
                      {EVENT_LABELS[e.type]} · {e.team === "opponent" ? "Rival" : e.playerId ? info(e.playerId).name : "Equipo"}
                      {e.receiverId ? ` → ${info(e.receiverId).name}` : ""}
                    </b>
                    <span>
                      {e.outcome ? OUTCOME_LABELS[e.outcome] : ""}
                      {e.keyPass ? " · pase clave" : ""}
                      {e.timingUnknown ? " · sin minuto" : ""}
                    </span>
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Quitar ${EVENT_LABELS[e.type]} ${e.minute ?? "sin minuto"}`} onClick={() => dropAction(e)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ol>
          )}
          {list.length > 30 && (
            <nav className="ac-pager" aria-label="Páginas de acciones">
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={at === 0 || undefined} onClick={() => at > 0 && setPage(at - 1)}>
                Anterior
              </button>
              <span className="sc-small">
                {at + 1} de {pages}
              </span>
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={at + 1 >= pages || undefined} onClick={() => at + 1 < pages && setPage(at + 1)}>
                Siguiente
              </button>
            </nav>
          )}
          {message && !event && (
            <p role="status" className="ae-message sc-small">
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
