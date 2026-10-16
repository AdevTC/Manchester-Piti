// «Mis ausencias» in the vestuario (spec §2): «no puedo del 12 al 19» said once, instead of answering each
// match. Members only (a fan never mounts the reader). Two Madrid dates and an optional note the team sees;
// «Añadir» writes absences/{id} (writes.addAbsence, the shape firestore.rules absenceOk() checks) and the
// backend answers «No puedo» on the matches in those dates — the member reads at once how many, counted
// here with the same rule (derived/absences). The list: your absences under way or to come, each with
// «Quitar», asked first (the backend then takes back only the «No puedo» nobody changed by hand).
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { dateMillis, type ClubMatch } from "../../lib/clubData";
import { apiError } from "../../lib/clubApi";
import {
  ABSENCE_NOTE_MAX,
  absenceFormProblem,
  absenceMatchCount,
  absenceRangeText,
  absenceSavedText,
  absenceSlots,
  madridDate,
  type Absence,
} from "../../lib/derived/absences";
import { Icon } from "../../components/celeste/icons";
import { useAbsences } from "./live";
import { addAbsence, deleteAbsence, useMe } from "./writes";
import "../../styles/vestuario-ausencias.css";

export interface AusenciasProps {
  /** Inside the vestuario (useViewer().member): only a member reads and writes absences. */
  member: boolean;
  /** The club's matches (useClubData): how many an absence answers. */
  matches: readonly ClubMatch[];
  /** The server's clock (Madrid «today» and the matches still to answer). */
  now: number;
}

export function Ausencias(props: AusenciasProps) {
  if (!props.member) return null;
  return <AusenciasBlock {...props} />;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const matchesText = (n: number) => (n ? `${n === 1 ? "1 partido" : `${n} partidos`} en esas fechas` : "Sin partidos en esas fechas por ahora");

function AusenciasBlock({ matches, now }: AusenciasProps) {
  const me = useMe();
  const today = madridDate(now);
  const absences = useAbsences(today, true);
  const uid = me?.uid;
  const mine = useMemo(() => (uid ? absences.data.filter((a) => a.uid === uid) : []), [absences.data, uid]);
  const slots = useMemo(() => absenceSlots(matches, dateMillis), [matches]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
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
    setSaved("");
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
      setSaved(`${cap(absenceRangeText(from, to))}. ${absenceSavedText(absenceMatchCount(slots, { from, to }, now))}`);
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

  return (
    <section className="vx-aus" id="vx-ausencias" aria-labelledby={`${id}-h`}>
      <span className="vx-kick">Tú · la convocatoria</span>
      <h2 className="vx-h2" id={`${id}-h`}>
        Mis ausencias
      </h2>
      <p className="vx-sub">¿Te vas unos días? Dilo una vez y contestamos «No puedo» en los partidos de esas fechas. Luego puedes cambiar cualquiera a mano.</p>
      <div className="aus-cols">
        <form className="aus-form" onSubmit={(e) => void submit(e)} noValidate aria-label="Añadir una ausencia">
          <div className="aus-dates">
            <label className="vx-field">
              Desde
              <input ref={fromRef} type="date" value={from} aria-invalid={!!shown} aria-describedby={shown ? `${id}-err` : undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="vx-field">
              Hasta
              <input ref={toRef} type="date" value={to} min={from || today} aria-invalid={!!shown} aria-describedby={shown ? `${id}-err` : undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <label className="vx-field">
            Nota (opcional)
            <input type="text" value={note} maxLength={ABSENCE_NOTE_MAX} placeholder="Vacaciones, trabajo, boda…" aria-describedby={`${id}-note`} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="aus-hint" id={`${id}-note`}>
            La ve todo el equipo · {note.length}/{ABSENCE_NOTE_MAX}
          </p>
          {/* (no live region: it changes as the dates do; «Añadir» moves the focus to the field, which reads it) */}
          {shown && (
            <p className="vx-error aus-err" id={`${id}-err`}>
              {shown}
            </p>
          )}
          {error && (
            <p className="vx-error" role="alert">
              {error}
            </p>
          )}
          <div className="aus-foot">
            <button type="submit" className="vx-btn" disabled={busy}>
              <Icon name="plus" size={16} stroke={2.4} />
              {busy ? "Guardando…" : "Añadir"}
            </button>
          </div>
          <p className="aus-saved" role="status">
            {saved && (
              <>
                <Icon name="check" size={16} stroke={2.6} />
                <span>{saved}</span>
              </>
            )}
          </p>
        </form>
        <div className="aus-list-wrap">
          <h3 className="aus-h3" id={`${id}-list`} ref={listH} tabIndex={-1}>
            Apuntadas
          </h3>
          {absences.loading && !mine.length ? (
            <p className="vx-sub" aria-busy="true">
              Mirando tus ausencias…
            </p>
          ) : absences.error && !mine.length ? (
            <p className="vx-error" role="alert">
              No se pudieron leer tus ausencias. Prueba a recargar dentro de un rato.
            </p>
          ) : mine.length ? (
            <ul className="aus-list" aria-labelledby={`${id}-list`}>
              {mine.map((a) => (
                <AbsenceRow key={a.id} absence={a} today={today} count={absenceMatchCount(slots, a, now)} onRemoved={() => listH.current?.focus()} />
              ))}
            </ul>
          ) : (
            <p className="vx-empty-line">No tienes ausencias apuntadas.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function AbsenceRow({ absence: a, today, count, onRemoved }: { absence: Absence; today: string; count: number; onRemoved: () => void }) {
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
  const range = cap(absenceRangeText(a.from, a.to));
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteAbsence(a.id);
      // (the row goes: the focus goes back to the list's title, never to the page's top)
      onRemoved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  };
  return (
    <li className="aus-row">
      <div className="aus-what">
        <b>
          {range}
          {a.from <= today && <span className="aus-now"> · ahora</span>}
        </b>
        <small>{matchesText(count)}</small>
        {a.note && <q className="aus-note">{a.note}</q>}
      </div>
      {asking ? (
        <div
          className="aus-ask"
          role="group"
          aria-label={`Quitar la ausencia ${absenceRangeText(a.from, a.to)}`}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setAsking(false);
          }}
        >
          <p>Borramos el «No puedo» de los partidos que no cambiaste a mano.</p>
          <div className="aus-ask-b">
            <button ref={yes} type="button" className="vx-btn" disabled={busy} onClick={() => void remove()}>
              {busy ? "Quitando…" : "Sí, quitarla"}
            </button>
            <button type="button" className="vx-btn ghost" disabled={busy} onClick={() => setAsking(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button ref={quitar} type="button" className="vx-btn ghost aus-quitar" onClick={() => setAsking(true)}>
          <Icon name="x" size={15} stroke={2.4} />
          Quitar <span className="vx-sr">la ausencia {absenceRangeText(a.from, a.to)}</span>
        </button>
      )}
      {error && (
        <p className="vx-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
