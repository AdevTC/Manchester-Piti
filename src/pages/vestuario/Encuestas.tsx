// «Encuestas» in the vestuario (docs/superpowers/specs/2026-10-16-encuestas-design.md): any member asks the
// team something quick and everyone answers here. Members only (a fan never mounts the readers). The open
// polls first, then the closed ones of the last 7 days (derived/polls visiblePolls); each with its options as
// radios (one answer) or checkboxes (several), a live bar, the count and the share, «Tú: X», «Votar» /
// «Cambiar mi voto», who voted what (public, folded after 5), and «Cerrar ya» / «Borrar» for the author or a
// captain. A closed poll says «Gana X» or «Empate entre X e Y» in words, with an icon. «Nueva encuesta» opens
// an inline form (writes.createPoll, the shape firestore.rules pollOk() checks); 3 open per author at most.
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { apiError } from "../../lib/clubApi";
import { serverNow } from "../../lib/serverTime";
import {
  POLL_DEFAULT_DURATION,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPEN_PER_AUTHOR,
  POLL_OPTION_MAX,
  POLL_QUESTION_MAX,
  canManagePoll,
  closesText,
  isPollOpen,
  myChoiceText,
  openPollsBy,
  outcomeText,
  pollFormProblem,
  pollOutcome,
  pollTally,
  validChoice,
  visiblePolls,
  type Poll,
  type PollDurationId,
} from "../../lib/derived/polls";
import { Icon } from "../../components/celeste/icons";
import { usePolls, usePollVotes } from "./live";
import { closePoll, createPoll, deletePoll, useMe, votePoll } from "./writes";
import "../../styles/vestuario-encuestas.css";

export interface EncuestasProps {
  /** Inside the vestuario (useViewer().member): only a member reads and writes polls. */
  member: boolean;
  /** A captain: closes and deletes any poll. */
  admin: boolean;
  /** The server's clock (open or closed, «Cierra en …»). */
  now: number;
}

export function Encuestas(props: EncuestasProps) {
  if (!props.member) return null;
  return <EncuestasBlock {...props} />;
}

/** Names shown before «Ver los N». */
const VOTERS_SHOWN = 5;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function EncuestasBlock({ admin, now }: EncuestasProps) {
  const me = useMe();
  const uid = me?.uid ?? "";
  const polls = usePolls(true);
  const list = useMemo(() => visiblePolls(polls.data, now), [polls.data, now]);
  const openMine = uid ? openPollsBy(polls.data, uid, now) : 0;
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const id = useId();
  const newBtn = useRef<HTMLButtonElement>(null);
  const full = openMine >= POLL_OPEN_PER_AUTHOR;

  const openForm = () => {
    setCreated(false);
    setCreating(true);
  };
  const closeForm = (saved: boolean) => {
    setCreating(false);
    setCreated(saved);
    // (back to where the member was: the «Nueva encuesta» button)
    requestAnimationFrame(() => newBtn.current?.focus());
  };

  return (
    <section className="vx-encuestas" id="encuestas" aria-labelledby={`${id}-h`}>
      <span className="vx-kick">El equipo · encuestas</span>
      <h2 className="vx-h2" id={`${id}-h`}>
        Encuestas
      </h2>
      <p className="vx-sub">Pregunta algo al equipo y vota. Todos ven quién votó qué.</p>

      {creating ? (
        <NewPoll openMine={openMine} onDone={closeForm} />
      ) : (
        <div className="en-new">
          <button ref={newBtn} type="button" className="vx-btn" disabled={full || !me} onClick={openForm} aria-describedby={full ? `${id}-full` : undefined}>
            <Icon name="plus" size={16} stroke={2.4} />
            Nueva encuesta
          </button>
          {full && (
            <p className="en-hint" id={`${id}-full`}>
              Ya tienes {POLL_OPEN_PER_AUTHOR} encuestas abiertas. Cierra una para abrir otra.
            </p>
          )}
        </div>
      )}
      <p className="en-saved" role="status">
        {created && (
          <>
            <Icon name="check" size={16} stroke={2.6} />
            <span>Publicada. Le llega un aviso a todo el equipo.</span>
          </>
        )}
      </p>

      {polls.loading && !list.length ? (
        <p className="vx-sub" aria-busy="true">
          Mirando las encuestas…
        </p>
      ) : polls.error && !list.length ? (
        <p className="vx-error" role="alert">
          No se pudieron leer las encuestas. Prueba a recargar dentro de un rato.
        </p>
      ) : list.length ? (
        <ul className="en-list" aria-label="Encuestas del vestuario">
          {list.map((p) => (
            <PollCard key={p.id} poll={p} uid={uid} admin={admin} now={now} />
          ))}
        </ul>
      ) : (
        <p className="vx-empty-line">No hay encuestas ahora mismo. ¿Preguntas tú?</p>
      )}
    </section>
  );
}

function PollCard({ poll, uid, admin, now }: { poll: Poll; uid: string; admin: boolean; now: number }) {
  const me = useMe();
  const votes = usePollVotes(poll.id);
  const open = isPollOpen(poll, now);
  const tally = useMemo(() => pollTally(poll, votes.data), [poll, votes.data]);
  const outcome = open ? null : pollOutcome(tally);
  const winners = new Set(outcome && outcome.kind !== "none" ? outcome.ids : []);
  const myVote = votes.data.find((v) => v.uid === uid);
  const mine = useMemo(() => (myVote ? validChoice(poll, myVote.optionIds) : []), [poll, myVote]);
  // what the member is picking (null: what they voted, live)
  const [picked, setPicked] = useState<string[] | null>(null);
  const choice = picked ?? mine;
  const same = choice.length === mine.length && choice.every((c) => mine.includes(c));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allVoters, setAllVoters] = useState(false);
  const [asking, setAsking] = useState(false);
  const manage = canManagePoll(poll, uid, admin);
  const id = useId();
  const yes = useRef<HTMLButtonElement>(null);
  const borrar = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    // the question takes the focus; «Cancelar» gives it back to «Borrar»
    if (asking) yes.current?.focus();
    else if (opened.current) borrar.current?.focus();
    opened.current = asking;
  }, [asking]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (err) {
      setError(apiError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const toggle = (optionId: string) => {
    if (!poll.multi) return setPicked([optionId]);
    setPicked(choice.includes(optionId) ? choice.filter((c) => c !== optionId) : [...choice, optionId]);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!me || !choice.length || same || busy) return;
    if (await run(() => votePoll(me, poll, choice))) setPicked(null);
  };

  const label = (oid: string) => poll.options.find((o) => o.id === oid)?.label ?? "";
  const voters = [...votes.data].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const shownVoters = allVoters ? voters : voters.slice(0, VOTERS_SHOWN);
  const you = myChoiceText(poll, myVote);

  return (
    <li className={`en-poll${open ? "" : " closed"}`} aria-labelledby={`${id}-q`}>
      <div className="en-head">
        <h3 className="en-q" id={`${id}-q`}>
          {poll.question}
        </h3>
        <p className="en-meta">
          <span>De {poll.authorName}</span>
          <span aria-hidden="true"> · </span>
          <span className={open ? "en-left" : "en-shut"}>
            {!open && <Icon name="lock" size={13} stroke={2.4} />}
            {closesText(poll, now)}
          </span>
          {poll.multi && (
            <>
              <span aria-hidden="true"> · </span>
              <span>Varias respuestas</span>
            </>
          )}
        </p>
      </div>

      {outcome && (
        <p className={`en-outcome ${outcome.kind}`}>
          <Icon name={outcome.kind === "winner" ? "trophy" : outcome.kind === "tie" ? "swap" : "minus"} size={18} stroke={2.4} />
          <span>{outcomeText(poll, outcome)}</span>
        </p>
      )}

      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset className={`en-opts${poll.multi ? " multi" : ""}`} disabled={!open || busy}>
          <legend className="vx-sr">
            {poll.question} · {poll.multi ? "marca las que quieras" : "elige una"}
          </legend>
          {tally.rows.map((r) => {
            const on = choice.includes(r.id);
            const win = winners.has(r.id);
            return (
              <label key={r.id} className={`en-opt${on ? " on" : ""}${win ? " win" : ""}`}>
                {open && <input type={poll.multi ? "checkbox" : "radio"} name={`${id}-opt`} value={r.id} checked={on} onChange={() => toggle(r.id)} />}
                <span className="en-mark" aria-hidden="true">
                  {open ? on && <Icon name="check" size={13} stroke={3.2} /> : win ? <Icon name={outcome?.kind === "tie" ? "swap" : "trophy"} size={14} stroke={2.4} /> : null}
                </span>
                <span className="en-label">
                  {r.label}
                  {win && <small className="en-tag">{outcome?.kind === "tie" ? " · empate" : " · gana"}</small>}
                </span>
                <span className="en-num">
                  {plural(r.count, "voto", "votos")} · {r.pct}%
                </span>
                <span className="en-bar" aria-hidden="true">
                  <i style={{ width: `${r.pct}%` }} />
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="en-you">
          <p className="en-mine">{you || (open ? "Aún no has votado." : "No votaste.")}</p>
          {open && (
            <button className="vx-btn" disabled={!me || busy || !choice.length || same}>
              {busy ? "Guardando…" : mine.length ? "Cambiar mi voto" : "Votar"}
            </button>
          )}
        </div>
      </form>

      {voters.length > 0 && (
        <div className="en-voters">
          <p className="en-voters-h">Votaron: {plural(voters.length, "persona", "personas")}</p>
          <ul id={`${id}-voters`}>
            {shownVoters.map((v) => (
              <li key={v.uid}>
                <b>{v.name}</b> {validChoice(poll, v.optionIds).map(label).join(", ")}
              </li>
            ))}
          </ul>
          {voters.length > VOTERS_SHOWN && (
            <button type="button" className="vx-link-btn en-more" aria-expanded={allVoters} aria-controls={`${id}-voters`} onClick={() => setAllVoters((x) => !x)}>
              {allVoters ? "Ver menos" : `Ver los ${voters.length}`}
            </button>
          )}
        </div>
      )}

      {manage &&
        (asking ? (
          <div className="en-ask" role="group" aria-label={`Borrar la encuesta «${poll.question}»`}>
            <p>¿Borrar la encuesta? Se va para todo el equipo, con sus votos.</p>
            <div className="en-ask-b">
              <button ref={yes} type="button" className="vx-btn" disabled={busy} onClick={() => void run(() => deletePoll(poll.id))}>
                {busy ? "Borrando…" : "Sí, borrarla"}
              </button>
              <button type="button" className="vx-btn ghost" disabled={busy} onClick={() => setAsking(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="en-manage" role="group" aria-label={admin && poll.authorUid !== uid ? "Capitán" : "Tu encuesta"}>
            {open && (
              <button type="button" className="vx-btn ghost" disabled={busy} onClick={() => void run(() => closePoll(poll.id))}>
                <Icon name="lock" size={15} stroke={2.4} />
                Cerrar ya
              </button>
            )}
            <button ref={borrar} type="button" className="vx-btn ghost" disabled={busy} onClick={() => setAsking(true)}>
              <Icon name="x" size={15} stroke={2.4} />
              Borrar
            </button>
          </div>
        ))}

      {error && (
        <p className="vx-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

const EMPTY_OPTIONS = ["", ""];

function NewPoll({ openMine, onDone }: { openMine: number; onDone: (saved: boolean) => void }) {
  const me = useMe();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [multi, setMulti] = useState(false);
  const [duration, setDuration] = useState<PollDurationId>(POLL_DEFAULT_DURATION);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const first = useRef<HTMLInputElement>(null);
  const optRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusOpt = useRef<number | null>(null);
  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    if (focusOpt.current === null) return;
    optRefs.current[focusOpt.current]?.focus();
    focusOpt.current = null;
  }, [options.length]);

  const form = { question, options, multi, duration };
  const problem = pollFormProblem(form, openMine);
  const shown = tried ? problem : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (problem || !me || busy) return;
    setBusy(true);
    try {
      await createPoll(me, form, serverNow());
      onDone(true);
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  };
  const setOption = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const addOption = () => {
    focusOpt.current = options.length;
    setOptions((o) => (o.length < POLL_MAX_OPTIONS ? [...o, ""] : o));
  };
  const removeOption = (i: number) => {
    focusOpt.current = Math.max(0, i - 1);
    setOptions((o) => (o.length > POLL_MIN_OPTIONS ? o.filter((_, j) => j !== i) : o));
  };

  return (
    <form className="en-form" onSubmit={(e) => void submit(e)} noValidate aria-labelledby={`${id}-h`} aria-describedby={shown ? `${id}-err` : undefined}>
      <h3 className="en-form-h" id={`${id}-h`}>
        Nueva encuesta
      </h3>
      <label className="vx-field">
        Pregunta
        <input ref={first} type="text" value={question} maxLength={POLL_QUESTION_MAX} placeholder="¿Cena el viernes?" aria-describedby={`${id}-qn`} onChange={(e) => setQuestion(e.target.value)} />
      </label>
      <p className="en-hint" id={`${id}-qn`}>
        {question.length}/{POLL_QUESTION_MAX}
      </p>

      <fieldset className="en-fs">
        <legend>
          Opciones <span className="en-hint">· de {POLL_MIN_OPTIONS} a {POLL_MAX_OPTIONS}</span>
        </legend>
        <ol className="en-form-opts">
          {options.map((o, i) => (
            <li key={i}>
              <input
                ref={(el) => {
                  optRefs.current[i] = el;
                }}
                type="text"
                value={o}
                maxLength={POLL_OPTION_MAX}
                aria-label={`Opción ${i + 1}`}
                placeholder={i === 0 ? "Sí" : i === 1 ? "No" : `Opción ${i + 1}`}
                onChange={(e) => setOption(i, e.target.value)}
              />
              {options.length > POLL_MIN_OPTIONS && (
                <button type="button" className="en-x" aria-label={`Quitar la opción ${i + 1}`} onClick={() => removeOption(i)}>
                  <Icon name="x" size={16} stroke={2.4} />
                </button>
              )}
            </li>
          ))}
        </ol>
        {options.length < POLL_MAX_OPTIONS && (
          <button type="button" className="vx-btn ghost en-add" onClick={addOption}>
            <Icon name="plus" size={15} stroke={2.4} />
            Añadir opción
          </button>
        )}
      </fieldset>

      <fieldset className="en-fs">
        <legend>Se cierra en</legend>
        <div className="en-seg">
          {POLL_DURATIONS.map((d) => (
            <label key={d.id} className={duration === d.id ? "on" : ""}>
              <input type="radio" name={`${id}-dur`} value={d.id} checked={duration === d.id} onChange={() => setDuration(d.id)} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="en-toggle">
        <input type="checkbox" role="switch" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
        <span className="en-switch" aria-hidden="true" />
        <span>
          Varias respuestas
          <small>{multi ? "Cada uno marca las que quiera" : "Cada uno elige una"}</small>
        </span>
      </label>

      {shown && (
        <p className="vx-error" id={`${id}-err`} role="alert">
          {shown}
        </p>
      )}
      {error && (
        <p className="vx-error" role="alert">
          {error}
        </p>
      )}
      <div className="en-form-foot">
        <button className="vx-btn" disabled={busy}>
          {busy ? "Publicando…" : "Publicar encuesta"}
        </button>
        <button type="button" className="vx-btn ghost" disabled={busy} onClick={() => onDone(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
