// /vestuario/ausencias · «Mis ausencias» as the canvas prototype draws it (SalaAusencias.dc.html): the head says where
// he stands («Fuera hasta el 27 nov»), the «cinta» of the next eight weeks shows the jornadas to come and the bars of
// who is away (his and the team's, with the draft's while he picks the dates), then the form, «Apuntadas» and the team.
// «Añadir» writes absences/{id} (writes.addAbsence, the shape firestore.rules absenceOk() checks) and the backend
// answers «No puedo» on the matches in those dates (functions absenceAnswers, derived/absences' plan) — the toast and
// the live preview say how many, counted with the same rule. «Quitar» is asked first (the backend then takes back only
// the «No puedo» nobody changed by hand).
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { dateMillis } from "../../../lib/clubData";
import { apiError } from "../../../lib/clubApi";
import { ABSENCE_NOTE_MAX, absenceMatchCount, absenceRangeText, absenceSavedText, absenceSlots, madridDate, type Absence } from "../../../lib/derived/absences";
import { jornadaNumbers } from "../../../lib/derived/jornada";
import { useAbsences } from "../live";
import { addAbsence, deleteAbsence } from "../writes";
import "../../../styles/vestuario/ausencias.css";
import type { VxCtx } from "./ctx";
import { Ic, PShirt, RoomHead, Tile } from "./kit";
import { absenceChip, ausenciasDraft, ausenciasHead, ausenciasMatchesLine, ausenciasRibbon, ausenciasTeamLine, cap, teamRows, upMatches, type TeamAway } from "./ausenciasView";

const BTN = "vd-glass vd-press nx-btn";
const BTN_PRI = `${BTN} nx-btn--pri`;

export function AusenciasBlock({ c }: { c: VxCtx }) {
  const me = c.me;
  const today = madridDate(c.now);
  const absences = useAbsences(today, !!c.uid);
  const mine = useMemo(() => (c.uid ? absences.data.filter((a) => a.uid === c.uid) : []), [absences.data, c.uid]);
  const slots = useMemo(() => absenceSlots(c.matches, dateMillis), [c.matches]);
  const jornada = useMemo(() => jornadaNumbers(c.matches), [c.matches]);
  const up = useMemo(() => upMatches(slots, c.now, c.matches, jornada), [slots, c.now, c.matches, jornada]);
  const known = useMemo(() => new Set(c.players.map((p) => p.id)), [c.players]);
  const whoOf = (a: Absence) => (a.playerId && known.has(a.playerId) ? c.nameOf(a.playerId) : "") || a.name;
  const teamLine = ausenciasTeamLine(absences.data, c.uid, today, whoOf);
  const team: TeamAway[] = absences.data
    .filter((a) => a.uid !== c.uid && a.to >= today)
    .map((a) => ({ key: a.id, name: whoOf(a), num: (a.playerId && c.squad.find((s) => s.id === a.playerId)?.num) || "", from: a.from, to: a.to, note: a.note?.trim().replace(/[.\s]+$/, "") ?? "" }));
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

  const draft = ausenciasDraft(from, to, today, up, tried);
  // (said once both dates are there, or on «Añadir»: never while the member is still picking the first)
  const shown = draft.showErr ? draft.err : "";
  const rib = ausenciasRibbon(today, up, mine, team, draft.err ? null : { from, to });
  const head = ausenciasHead(mine, today, up);
  const loadingFirst = absences.loading && !mine.length;
  const failed = absences.error && !mine.length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (draft.err) {
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
  const rows = teamRows(team, today, up);

  return (
    <section className="vau" aria-labelledby="ve-room-h">
      <RoomHead
        room="ausencias"
        icon="cal"
        kick="Mis ausencias · tú y la convocatoria"
        title={loadingFirst || failed ? "Mis ausencias" : head.title}
        sub={loadingFirst || failed ? "¿Te vas unos días? Dilo una vez y contestamos «No puedo» en los partidos de esas fechas. Luego puedes cambiar cualquiera a mano." : head.sub}
      />

      <section className="ve-panel" aria-labelledby={`${id}-rib`}>
        <div className="nx-sec__head">
          <h2 className="nx-h3" id={`${id}-rib`}>
            Las próximas semanas
          </h2>
          <p className="nx-meta">{rib.meta}</p>
        </div>
        <figure className="vau-rib" role="img" aria-label={rib.aria}>
          <div className="vau-rib__scroll">
            <div className="vau-rib__in">
              <div className="vau-weeks">
                {rib.weeks.map((w) => (
                  <span key={w.t} className={w.now ? "is-now" : undefined}>
                    {w.t}
                  </span>
                ))}
              </div>
              <div className="vau-track">
                <div className="vau-grid">
                  {rib.weeks.map((w) => (
                    <i key={w.t} />
                  ))}
                </div>
                <div className="vau-past" style={{ width: rib.past }} />
                {rib.marks.map((m) => (
                  <div key={m.id} className="vau-guide" style={{ left: m.left }} />
                ))}
                <div className="vau-today" style={{ left: rib.past }}>
                  <span>Hoy</span>
                </div>
                <div className="vau-lanes">
                  <div className="vau-lane vau-lane--m">
                    {rib.marks.map((m) => (
                      <div key={m.id} className={["vau-match", m.no ? "is-no" : m.fresh ? "is-new" : "", m.edge].filter(Boolean).join(" ")} style={{ left: m.left }}>
                        <b>{m.j}</b>
                        <span>{m.day}</span>
                        {(m.no || m.fresh) && <em>No puedo</em>}
                      </div>
                    ))}
                  </div>
                  {rib.myBars.map((b) => (
                    <div key={b.key} className="vau-lane vau-lane--me">
                      <span className="vau-lbl" style={b.lbl}>
                        <b>{b.who}</b> · {b.t}
                      </span>
                      <span className={`vau-bar${b.cut ? " is-cut" : ""}`} style={b.bar} />
                    </div>
                  ))}
                  {rib.newBar && (
                    <div className="vau-lane vau-lane--me vau-lane--new">
                      <span className="vau-lbl" style={rib.newBar.lbl}>
                        <b>Nueva</b> · {rib.newBar.t}
                      </span>
                      <span className="vau-bar" style={rib.newBar.bar} />
                    </div>
                  )}
                  <div className="vau-lane vau-lane--sep" />
                  {rib.teamBars.map((b) => (
                    <div key={b.key} className="vau-lane">
                      <span className="vau-lbl" style={b.lbl}>
                        <b>{b.who}</b> · {b.t}
                      </span>
                      <span className={`vau-bar${b.cut ? " is-cut" : ""}`} style={b.bar} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </figure>
        <p className="vau-legend" aria-hidden="true">
          <span>
            <i className="vau-sw vau-sw--me" />
            Tú
          </span>
          <span>
            <i className="vau-sw" />
            El equipo
          </span>
          <span>
            <i className="vau-sw vau-sw--no">No puedo</i>lo contestamos por ti
          </span>
        </p>
      </section>

      <div className="ve-cols vau-cols">
        <div className="ve-stack">
          <section className="vd-glass vd-glass--deep ve-card" aria-labelledby={`${id}-form`}>
            <p className="ve-card__k">Dilo una vez</p>
            <h2 id={`${id}-form`}>Añadir una ausencia</h2>
            <form className="vau-form" onSubmit={(e) => void submit(e)} noValidate aria-labelledby={`${id}-form`}>
              <div className="ve-row2">
                <label className="ve-lab">
                  Desde
                  <input ref={fromRef} className="ve-in" type="date" value={from} aria-invalid={!!shown} aria-describedby={shown ? `${id}-err` : undefined} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="ve-lab">
                  Hasta
                  <input
                    ref={toRef}
                    className="ve-in"
                    type="date"
                    value={to}
                    min={from && from > today ? from : today}
                    aria-invalid={!!shown}
                    aria-describedby={shown ? `${id}-err` : undefined}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
              <label className="ve-lab">
                Nota (opcional)
                <input className="ve-in" type="text" value={note} maxLength={ABSENCE_NOTE_MAX} placeholder="Vacaciones, trabajo, boda…" aria-describedby={`${id}-note`} onChange={(e) => setNote(e.target.value)} />
              </label>
              <p className="ve-count" id={`${id}-note`}>
                La ve todo el equipo · {note.length}/{ABSENCE_NOTE_MAX}
              </p>
              {/* (no live region: it changes as the dates do; «Añadir» moves the focus to the field, which reads it) */}
              {shown && (
                <div className="vau-prev is-err">
                  <Tile icon="warn" warn />
                  <span className="vau-prev__t">
                    <b>Así no se puede guardar</b>
                    <span id={`${id}-err`}>{shown}</span>
                  </span>
                </div>
              )}
              {!draft.err && (
                <div className="vau-prev">
                  <Tile icon="cal" />
                  <span className="vau-prev__t">
                    <b>{draft.k}</b>
                    <span>{draft.text}</span>
                  </span>
                </div>
              )}
              {draft.hint && <p className="nx-meta">Elige hasta qué día y te decimos en qué partidos contestamos «No puedo».</p>}
              {error && (
                <p className="ve-err" role="alert">
                  {error}
                </p>
              )}
              <div className="ve-acts">
                <button type="submit" className={BTN_PRI} disabled={busy || !me}>
                  <Ic name="calAdd" />
                  {busy ? "Guardando…" : "Añadir"}
                </button>
                <span className="nx-meta">Luego puedes cambiar cualquier partido a mano.</span>
              </div>
            </form>
          </section>

          <section className="nx-sec vau-mine" aria-labelledby={`${id}-list`}>
            <div className="nx-sec__head">
              <h2 className="nx-h3" id={`${id}-list`} ref={listH} tabIndex={-1}>
                Apuntadas
              </h2>
              {mine.length > 0 && <p className="nx-meta">{mine.length === 1 ? "1 ausencia" : `${mine.length} ausencias`} · en curso o por venir</p>}
            </div>
            {loadingFirst ? (
              <p className="nx-meta" aria-busy="true">
                Mirando tus ausencias…
              </p>
            ) : failed ? (
              <p className="ve-err" role="alert">
                No se pudieron leer tus ausencias. Prueba a recargar dentro de un rato.
              </p>
            ) : mine.length ? (
              <ul className="vau-list" aria-label="Tus ausencias">
                {mine.map((a) => (
                  <AbsenceRow key={a.id} absence={a} today={today} matchesLine={ausenciasMatchesLine(slots, a, c.now, c.matches, jornada)} onRemoved={removed} />
                ))}
              </ul>
            ) : (
              <div className="ve-empty">
                <Tile icon="cal" />
                <h3>No tienes ausencias apuntadas.</h3>
                <p>¿Boda, viaje o turno de trabajo? Apúntalo con «Añadir una ausencia» y contestamos «No puedo» por ti en los partidos de esas fechas.</p>
                <div className="ve-acts">
                  <button type="button" className={BTN_PRI} onClick={() => fromRef.current?.focus()}>
                    <Ic name="calAdd" />
                    Añadir una ausencia
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="ve-side ve-stack">
          {rows.length > 0 && (
            <section className="ve-panel" aria-labelledby={`${id}-team`}>
              <div className="nx-sec__head vau-team__head">
                <h2 className="nx-h3" id={`${id}-team`}>
                  En el equipo
                </h2>
                <p className="nx-meta">{rows.length} fuera estas semanas</p>
              </div>
              <ul className="ve-list vau-team" aria-label="Ausencias del equipo">
                {rows.map((r) => (
                  <li key={r.key} className="ve-row">
                    <PShirt n={r.num} />
                    <span className="ve-row__t">
                      <b>{r.name}</b>
                      <span>{r.line}</span>
                    </span>
                    <span className="ve-row__v nx-meta">{r.miss}</span>
                  </li>
                ))}
              </ul>
              <p className="nx-note">{teamLine}</p>
            </section>
          )}
          <section className="ve-panel" aria-labelledby={`${id}-how`}>
            <h2 className="nx-h3 vau-how__h" id={`${id}-how`}>
              Cómo funciona
            </h2>
            <p className="vau-how">
              ¿Te vas unos días? <b>Dilo una vez</b> y contestamos «No puedo» en los partidos de esas fechas. Luego puedes cambiar cualquiera a mano.
            </p>
            <p className="vau-how">Si se publica un partido nuevo en esas fechas, también contestamos por ti. Al quitarla, borramos el «No puedo» de los partidos que no cambiaste a mano.</p>
          </section>
        </div>
      </div>
    </section>
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
  const chip = absenceChip(a);
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
    <li className="vau-item">
      <span className="vau-date" aria-hidden="true">
        <b>{chip.big}</b>
        <span>{chip.mon}</span>
      </span>
      <span className="ve-row__t">
        <b>
          {cap(range)}
          {a.from <= today && (
            <>
              <span className="nx-vh"> · </span>
              <span className="vau-now">ahora</span>
            </>
          )}
        </b>
        <span>{matchesLine}</span>
        {a.note && <small>«{a.note}»</small>}
      </span>
      {!asking && (
        <button ref={quitar} type="button" className={BTN} aria-label={`Quitar la ausencia ${range}`} onClick={() => setAsking(true)}>
          <Ic name="trash" />
          Quitar
        </button>
      )}
      {asking && (
        <div
          className="ve-confirm"
          role="group"
          aria-label={`Quitar la ausencia ${range}`}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setAsking(false);
          }}
        >
          <p>Borramos el «No puedo» de los partidos que no cambiaste a mano.</p>
          <div className="ve-acts">
            <button ref={yes} type="button" className={`${BTN} nx-btn--danger`} disabled={busy} onClick={() => void remove()}>
              {busy ? "Quitando…" : "Sí, quitarla"}
            </button>
            <button type="button" className={BTN} disabled={busy} onClick={() => setAsking(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="ve-err vau-item__err" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
