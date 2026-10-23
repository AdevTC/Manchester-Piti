// /vestuario/ausencias · the block's body as the CL- board draws it (part-vestuario vx.g.ausencias): «no puedo
// del 12 al 19» said once. Two Madrid dates and an optional note the team sees; «Añadir» writes absences/{id}
// (writes.addAbsence, the shape firestore.rules absenceOk() checks) and the backend answers «No puedo» on the
// matches in those dates (functions absenceAnswers, derived/absences' plan) — the toast says how many, counted
// with the same rule. «Apuntadas»: the member's absences under way or to come, each with its matches and
// «Quitar», asked first (the backend then takes back only the «No puedo» nobody changed by hand). Under it, who
// else in the team is away.
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { dateMillis } from "../../../lib/clubData";
import { apiError } from "../../../lib/clubApi";
import { ABSENCE_NOTE_MAX, absenceFormProblem, absenceMatchCount, absenceRangeText, absenceSavedText, absenceSlots, madridDate, type Absence } from "../../../lib/derived/absences";
import { jornadaNumbers } from "../../../lib/derived/jornada";
import { useAbsences } from "../live";
import { addAbsence, deleteAbsence } from "../writes";
import type { VxCtx } from "./ctx";
import { ausenciasMatchesLine, ausenciasTeamLine, cap } from "./ausenciasView";

const BTN = "vd-glass vd-press vd-btn vd-btn--sm";
const BTN_PRI = `${BTN} vd-btn--pri`;

export function AusenciasBlock({ c }: { c: VxCtx }) {
  const me = c.me;
  const today = madridDate(c.now);
  const absences = useAbsences(today, !!c.uid);
  const mine = useMemo(() => (c.uid ? absences.data.filter((a) => a.uid === c.uid) : []), [absences.data, c.uid]);
  const slots = useMemo(() => absenceSlots(c.matches, dateMillis), [c.matches]);
  const jornada = useMemo(() => jornadaNumbers(c.matches), [c.matches]);
  const known = useMemo(() => new Set(c.players.map((p) => p.id)), [c.players]);
  const teamLine = ausenciasTeamLine(absences.data, c.uid, today, (a) => (a.playerId && known.has(a.playerId) ? c.nameOf(a.playerId) : "") || a.name);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const listH = useRef<HTMLHeadingElement>(null);

  const problem = absenceFormProblem(from, to, today);
  // (said once both dates are there, or on «Añadir»: never while the member is still picking the first)
  const shown = problem && (tried || (!!from && !!to)) ? problem : "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (problem) {
      // (the first field to fix takes the focus; it reads the error through aria-describedby)
      (from ? toRef : fromRef).current?.focus();
      return;
    }
    if (!me || busy) return;
    setBusy(true);
    try {
      await addAbsence(me, from, to, note);
      c.say(`${cap(absenceRangeText(from, to))}. ${absenceSavedText(absenceMatchCount(slots, { from, to }, c.now))}`);
      setFrom(today);
      setTo("");
      setNote("");
      setTried(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };
  const removed = () => {
    c.say("Ausencia quitada.");
    // (the row goes: the focus goes back to the list's title, never to the page's top)
    listH.current?.focus();
  };

  return (
    <div className="cb-abs">
      <p className="cb-small">¿Te vas unos días? Dilo una vez y contestamos «No puedo» en los partidos de esas fechas. Luego puedes cambiar cualquiera a mano.</p>
      <form className="cb-abs__form" onSubmit={(e) => void submit(e)} noValidate aria-label="Añadir una ausencia">
        <label>
          <span className="vd-label">Desde</span>
          <input ref={fromRef} className="vd-input" type="date" value={from} aria-invalid={!!shown} aria-describedby={shown ? `${id}-err` : undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span className="vd-label">Hasta</span>
          <input ref={toRef} className="vd-input" type="date" value={to} min={from || today} aria-invalid={!!shown} aria-describedby={shown ? `${id}-err` : undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="cb-abs__note">
          <span className="vd-label">Nota (opcional)</span>
          <input className="vd-input" type="text" value={note} maxLength={ABSENCE_NOTE_MAX} placeholder="Vacaciones, trabajo, boda…" aria-describedby={`${id}-note`} onChange={(e) => setNote(e.target.value)} />
          <span className="cb-small" id={`${id}-note`}>
            La ve todo el equipo · {note.length}/{ABSENCE_NOTE_MAX}
          </span>
        </label>
        <button type="submit" className={BTN_PRI} disabled={busy || !me}>
          {busy ? "Guardando…" : "Añadir"}
        </button>
      </form>
      {/* (no live region: it changes as the dates do; «Añadir» moves the focus to the field, which reads it) */}
      {shown && (
        <p className="cb-small" id={`${id}-err`}>
          {shown}
        </p>
      )}
      {error && (
        <p className="cb-small" role="alert">
          {error}
        </p>
      )}

      <h4 id={`${id}-list`} ref={listH} tabIndex={-1}>
        Apuntadas
      </h4>
      {absences.loading && !mine.length ? (
        <p className="cb-small" aria-busy="true">
          Mirando tus ausencias…
        </p>
      ) : absences.error && !mine.length ? (
        <p className="cb-small" role="alert">
          No se pudieron leer tus ausencias. Prueba a recargar dentro de un rato.
        </p>
      ) : mine.length ? (
        <ul className="cb-abs__l" aria-labelledby={`${id}-list`}>
          {mine.map((a) => (
            <AbsenceRow key={a.id} absence={a} today={today} matchesLine={ausenciasMatchesLine(slots, a, c.now, c.matches, jornada)} onRemoved={removed} />
          ))}
        </ul>
      ) : (
        <p className="cb-small">No tienes ausencias apuntadas.</p>
      )}
      {teamLine && <p className="cb-small">{teamLine}</p>}
    </div>
  );
}

function AbsenceRow({ absence: a, today, matchesLine, onRemoved }: { absence: Absence; today: string; matchesLine: string; onRemoved: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const yes = useRef<HTMLButtonElement>(null);
  const quitar = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    // the question takes the focus; «Cancelar» gives it back to «Quitar»
    if (asking) yes.current?.focus();
    else if (opened.current) quitar.current?.focus();
    opened.current = asking;
  }, [asking]);
  const range = absenceRangeText(a.from, a.to);
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteAbsence(a.id);
      onRemoved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  };
  return (
    <li>
      <b>
        {cap(range)}
        {a.from <= today && " · ahora"}
      </b>
      <span>{matchesLine}</span>
      {a.note && <span>«{a.note}»</span>}
      {asking ? (
        <div
          role="group"
          aria-label={`Quitar la ausencia ${range}`}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setAsking(false);
          }}
        >
          <p className="cb-small">Borramos el «No puedo» de los partidos que no cambiaste a mano.</p>
          <div className="cb-row-acts">
            <button ref={yes} type="button" className={BTN_PRI} disabled={busy} onClick={() => void remove()}>
              {busy ? "Quitando…" : "Sí, quitarla"}
            </button>
            <button type="button" className={BTN} disabled={busy} onClick={() => setAsking(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button ref={quitar} type="button" className="vd-link" onClick={() => setAsking(true)}>
          Quitar <span className="vd-vh">la ausencia {range}</span>
        </button>
      )}
      {error && (
        <p className="cb-small" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
