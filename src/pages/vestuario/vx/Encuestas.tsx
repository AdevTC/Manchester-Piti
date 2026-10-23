// /vestuario/encuestas · the block's body as the CL- board draws it (part-vestuario vx.g.encuestas): one
// cb-poll per poll (open first; the one a notice named, /vestuario/encuestas/<id>, first of all and focused),
// its options as cb-poll__o radios (one answer: a tap votes, «Voto guardado») or checkboxes (several: pick, then
// «Votar» / «Cambiar mi voto»), the live bar and share, «Votaron: N personas» with who voted what (folded after
// 5), «Gana X» / the tie once closed, «Cerrar ya» / «Borrar» (asked first) for the author or a captain, and the
// «Nueva encuesta» form (writes.createPoll, the shape firestore.rules pollOk() checks; 3 open per author).
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { apiError } from "../../../lib/clubApi";
import { serverNow } from "../../../lib/serverTime";
import {
  POLL_DEFAULT_DURATION,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPEN_PER_AUTHOR,
  POLL_OPTION_MAX,
  POLL_QUESTION_MAX,
  canManagePoll,
  isPollOpen,
  joinEs,
  openPollsBy,
  outcomeText,
  pollFormProblem,
  pollOutcome,
  pollTally,
  validChoice,
  type Poll,
  type PollDurationId,
} from "../../../lib/derived/polls";
import { I } from "../../club/cb/ui";
import { usePolls, usePollVotes } from "../live";
import { closePoll, createPoll, deletePoll, votePoll } from "../writes";
import type { VxCtx } from "./ctx";
import { encuestasMeta, encuestasOrder, encuestasVotersLine, plural } from "./encuestasView";

/** Names shown before «Ver los N». */
const VOTERS_SHOWN = 5;
const BTN = "vd-glass vd-press vd-btn vd-btn--sm";
const BTN_PRI = `${BTN} vd-btn--pri`;
const pollDomId = (id: string) => `cb-poll-${id}`;
const smooth = () => typeof window !== "undefined" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function EncuestasBlock({ c }: { c: VxCtx }) {
  const polls = usePolls(!!c.uid);
  const { list, missing } = useMemo(() => encuestasOrder(polls.data, c.now, c.pollId), [polls.data, c.now, c.pollId]);
  const openMine = c.uid ? openPollsBy(polls.data, c.uid, c.now) : 0;
  const full = openMine >= POLL_OPEN_PER_AUTHOR;
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  // polls deleted here (the address may still name one: that is no «ya no está»)
  const [gone, setGone] = useState<readonly string[]>([]);
  const id = useId();
  const newBtn = useRef<HTMLButtonElement>(null);

  // The poll a notice named: once the polls are in, bring it into view and give it the focus.
  const jumped = useRef<string | null>(null);
  useEffect(() => {
    if (!c.pollId || polls.loading || jumped.current === c.pollId) return;
    jumped.current = c.pollId;
    const el = document.getElementById(pollDomId(c.pollId));
    if (!el) return;
    el.scrollIntoView?.({ behavior: smooth() ? "smooth" : "auto", block: "start" });
    el.focus({ preventScroll: true });
  }, [c.pollId, polls.loading]);

  const openForm = () => {
    setCreated(false);
    setCreating(true);
  };
  const closeForm = (saved: boolean) => {
    setCreating(false);
    setCreated(saved);
    if (saved) c.say("Publicada. Le llega un aviso a todo el equipo.");
    // (back to where the member was: the «Nueva encuesta» button)
    requestAnimationFrame(() => newBtn.current?.focus());
  };
  const deleted = (pollId: string) => {
    setGone((g) => [...g, pollId]);
    c.say("Encuesta borrada.");
    requestAnimationFrame(() => newBtn.current?.focus());
  };

  return (
    <>
      {missing && !polls.loading && !polls.error && !(c.pollId && gone.includes(c.pollId)) && <p className="cb-small">Esa encuesta ya no está: la borraron.</p>}

      {polls.loading && !list.length ? (
        <p className="cb-small" aria-busy="true">
          Mirando las encuestas…
        </p>
      ) : polls.error && !list.length ? (
        <p className="cb-small" role="alert">
          No se pudieron leer las encuestas. Prueba a recargar dentro de un rato.
        </p>
      ) : list.length ? (
        list.map((p) => <PollCard key={p.id} poll={p} c={c} named={p.id === c.pollId} onDeleted={() => deleted(p.id)} />)
      ) : (
        <p className="cb-small">No hay encuestas ahora mismo. ¿Preguntas tú?</p>
      )}

      {creating ? (
        <NewPoll c={c} openMine={openMine} onDone={closeForm} />
      ) : (
        <div>
          <button ref={newBtn} type="button" className={BTN} disabled={full || !c.me} onClick={openForm} aria-describedby={full ? `${id}-full` : undefined}>
            <I n="poll" />
            Nueva encuesta
          </button>
          {full && (
            <p className="cb-small" id={`${id}-full`}>
              Ya tienes {POLL_OPEN_PER_AUTHOR} encuestas abiertas. Cierra una para abrir otra.
            </p>
          )}
          {created && (
            <p className="cb-ok">
              <I n="check" />
              Publicada. Le llega un aviso a todo el equipo.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function PollCard({ poll, c, named, onDeleted }: { poll: Poll; c: VxCtx; named: boolean; onDeleted: () => void }) {
  const me = c.me;
  const votes = usePollVotes(poll.id);
  const open = isPollOpen(poll, c.now);
  const tally = useMemo(() => pollTally(poll, votes.data), [poll, votes.data]);
  const outcome = open ? null : pollOutcome(tally);
  const winners = new Set(outcome && outcome.kind !== "none" ? outcome.ids : []);
  const myVote = votes.data.find((v) => v.uid === c.uid);
  const mine = useMemo(() => (myVote ? validChoice(poll, myVote.optionIds) : []), [poll, myVote]);
  // what the member is picking (null: what they voted, live)
  const [picked, setPicked] = useState<string[] | null>(null);
  const choice = picked ?? mine;
  const sameAs = (ids: readonly string[]) => ids.length === mine.length && ids.every((x) => mine.includes(x));
  const same = sameAs(choice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allVoters, setAllVoters] = useState(false);
  const [asking, setAsking] = useState(false);
  const manage = canManagePoll(poll, c.uid, c.admin);
  const id = useId();
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);
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
  const label = (oid: string) => poll.options.find((o) => o.id === oid)?.label ?? "";
  const save = async (ids: string[]) => {
    if (!me || busy || !ids.length || sameAs(ids)) return;
    setPicked(ids);
    const ok = await run(() => votePoll(me, poll, ids));
    setPicked(null);
    if (ok) c.say(`Voto guardado: «${joinEs(validChoice(poll, ids).map(label))}».`);
  };
  const tap = (optionId: string) => {
    if (!open || busy || !me) return;
    // one answer: the tap is the vote; several: the tap picks, «Votar» saves
    if (!poll.multi) return void save([optionId]);
    setPicked(choice.includes(optionId) ? choice.filter((x) => x !== optionId) : [...choice, optionId]);
  };
  // the radios rove with the arrows (moving never votes: Space or Enter does)
  const rove = (e: KeyboardEvent<HTMLDivElement>) => {
    const btns = optRefs.current.filter((b): b is HTMLButtonElement => !!b && !b.disabled);
    const at = btns.findIndex((b) => b === document.activeElement);
    if (at < 0) return;
    const to =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? (at + 1) % btns.length : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (at - 1 + btns.length) % btns.length : e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    btns[to].focus();
  };
  const tabStop = Math.max(
    0,
    tally.rows.findIndex((r) => choice.includes(r.id)),
  );

  const voters = [...votes.data].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const shownVoters = allVoters ? voters : voters.slice(0, VOTERS_SHOWN);
  // (a failed read never passes for «nobody voted»)
  const votersLine = votes.error
    ? "No se pudieron leer los votos. Prueba a recargar dentro de un rato."
    : votes.loading && !votes.data.length
      ? "Contando los votos…"
      : encuestasVotersLine(tally.voters, mine.length > 0, open);

  // «Cerrar ya» goes once the poll closes: the focus moves to «Borrar», the control that stays
  const close = async () => {
    if (await run(() => closePoll(poll.id))) {
      c.say("Encuesta cerrada.");
      requestAnimationFrame(() => borrar.current?.focus());
    }
  };
  const remove = async () => {
    if (await run(() => deletePoll(poll.id))) onDeleted();
  };

  return (
    <div className="cb-poll" id={pollDomId(poll.id)} role="group" aria-labelledby={`${id}-q`} tabIndex={named ? -1 : undefined}>
      <p className="cb-poll__q" id={`${id}-q`}>
        {poll.question}
      </p>
      <p className="cb-small">{encuestasMeta(poll, c.now)}</p>
      {outcome && outcome.kind !== "none" && (
        <p className="cb-small">
          <b>{outcomeText(poll, outcome)}</b>
        </p>
      )}
      <div className="cb-poll__opts" role={poll.multi ? "group" : "radiogroup"} aria-label={poll.multi ? "Tus votos · marca las que quieras" : "Tu voto"} onKeyDown={poll.multi ? undefined : rove}>
        {tally.rows.map((r, i) => {
          const on = choice.includes(r.id);
          const win = winners.has(r.id);
          return (
            <button
              key={r.id}
              ref={(el) => {
                optRefs.current[i] = el;
              }}
              type="button"
              role={poll.multi ? "checkbox" : "radio"}
              className="cb-poll__o"
              aria-checked={on}
              aria-disabled={busy || !me ? true : undefined}
              disabled={!open}
              tabIndex={poll.multi || i === tabStop ? 0 : -1}
              onClick={() => tap(r.id)}
            >
              <span className="cb-poll__dot" aria-hidden="true" />
              <b>
                {r.label}
                {win && <small>{outcome?.kind === "tie" ? " · empate" : " · gana"}</small>}
              </b>
              <span className="cb-poll__bar" aria-hidden="true">
                <i style={{ width: `${r.pct}%` }} />
              </span>
              <span>
                {plural(r.count, "voto", "votos")} · {r.pct} %
              </span>
            </button>
          );
        })}
      </div>
      {open && poll.multi && (
        <div>
          <button type="button" className={BTN_PRI} disabled={!me || busy || !choice.length || same} onClick={() => void save(choice)}>
            {busy ? "Guardando…" : mine.length ? "Cambiar mi voto" : "Votar"}
          </button>
        </div>
      )}

      <p className="cb-small" role={votes.error ? "alert" : undefined}>
        {votersLine}
      </p>
      {voters.length > 0 && (
        <>
          <ul className="cb-poll__who" id={`${id}-voters`} aria-label="Quién votó qué">
            {shownVoters.map((v) => (
              <li key={v.uid} className="cb-small">
                <b>{v.name}</b> {validChoice(poll, v.optionIds).map(label).join(", ")}
              </li>
            ))}
          </ul>
          {voters.length > VOTERS_SHOWN && (
            <div>
              <button type="button" className="vd-link" aria-expanded={allVoters} aria-controls={`${id}-voters`} onClick={() => setAllVoters((x) => !x)}>
                {allVoters ? "Ver menos" : `Ver los ${voters.length}`}
              </button>
            </div>
          )}
        </>
      )}

      {manage &&
        (asking ? (
          <div
            role="group"
            aria-label={`Borrar la encuesta «${poll.question}»`}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setAsking(false);
            }}
          >
            <p className="cb-small">¿Borrar la encuesta? Se va para todo el equipo, con sus votos.</p>
            <div className="cb-row-acts">
              <button ref={yes} type="button" className={BTN_PRI} disabled={busy} onClick={() => void remove()}>
                {busy ? "Borrando…" : "Sí, borrarla"}
              </button>
              <button type="button" className={BTN} disabled={busy} onClick={() => setAsking(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="cb-row-acts" role="group" aria-label={c.admin && poll.authorUid !== c.uid ? "Capitán" : "Tu encuesta"}>
            {open && (
              <button type="button" className="vd-link" disabled={busy} onClick={() => void close()}>
                Cerrar ya
              </button>
            )}
            <button ref={borrar} type="button" className="vd-link" disabled={busy} onClick={() => setAsking(true)}>
              Borrar
            </button>
          </div>
        ))}

      {error && (
        <p className="cb-small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const EMPTY_OPTIONS = ["", ""];

function NewPoll({ c, openMine, onDone }: { c: VxCtx; openMine: number; onDone: (saved: boolean) => void }) {
  const me = c.me;
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
  // Which field the problem is about: with two good options in place, only the question's own is left
  // (and the open-polls limit belongs to no field).
  const questionProblem = pollFormProblem({ ...form, options: ["1", "2"] }, 0) !== null;
  const field = problem && openMine < POLL_OPEN_PER_AUTHOR ? (questionProblem ? "question" : "options") : null;
  const shownField = shown ? field : null;
  const errId = `${id}-err`;
  const durIndex = Math.max(
    0,
    POLL_DURATIONS.findIndex((d) => d.id === duration),
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (problem) {
      // (the first field to fix takes the focus; it reads the error through aria-describedby)
      if (field === "question") first.current?.focus();
      else if (field === "options") (optRefs.current[options.findIndex((o) => !o.trim())] ?? optRefs.current[0])?.focus();
      return;
    }
    if (!me || busy) return;
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
    <form className="cb-poll cb-poll--new" onSubmit={(e) => void submit(e)} noValidate aria-labelledby={`${id}-h`} aria-describedby={shown && !shownField ? errId : undefined}>
      <p className="cb-poll__q" id={`${id}-h`}>
        Nueva encuesta
      </p>
      <label className="cb-poll__f">
        <span className="vd-label">Pregunta</span>
        <input
          ref={first}
          className="vd-input"
          type="text"
          value={question}
          maxLength={POLL_QUESTION_MAX}
          placeholder="¿Cena el viernes?"
          aria-invalid={shownField === "question"}
          aria-describedby={shownField === "question" ? `${errId} ${id}-qn` : `${id}-qn`}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <span className="cb-small" id={`${id}-qn`}>
          {question.length}/{POLL_QUESTION_MAX}
        </span>
      </label>

      <div className="cb-poll__f" role="group" aria-labelledby={`${id}-oh`}>
        <span className="vd-label" id={`${id}-oh`}>
          Opciones · de {POLL_MIN_OPTIONS} a {POLL_MAX_OPTIONS}
        </span>
        <ol className="cb-poll__new">
          {options.map((o, i) => (
            <li key={i}>
              <input
                ref={(el) => {
                  optRefs.current[i] = el;
                }}
                className="vd-input"
                type="text"
                value={o}
                maxLength={POLL_OPTION_MAX}
                aria-label={`Opción ${i + 1}`}
                aria-invalid={shownField === "options"}
                aria-describedby={shownField === "options" ? errId : undefined}
                placeholder={i === 0 ? "Sí" : i === 1 ? "No" : `Opción ${i + 1}`}
                onChange={(e) => setOption(i, e.target.value)}
              />
              {options.length > POLL_MIN_OPTIONS && (
                <button type="button" className="vd-link" aria-label={`Quitar la opción ${i + 1}`} onClick={() => removeOption(i)}>
                  <I n="close" />
                </button>
              )}
            </li>
          ))}
        </ol>
        {options.length < POLL_MAX_OPTIONS && (
          <div>
            <button type="button" className="vd-link" onClick={addOption}>
              Añadir opción
            </button>
          </div>
        )}
      </div>

      <div className="cb-poll__f">
        <span className="vd-label" id={`${id}-dur`}>
          Se cierra en
        </span>
        <div className="vd-glass vd-seg" style={{ "--n": POLL_DURATIONS.length, "--i": durIndex } as CSSProperties} role="group" aria-labelledby={`${id}-dur`}>
          <span className="vd-shelf__bead" aria-hidden="true" />
          {POLL_DURATIONS.map((d) => (
            <button key={d.id} type="button" className="vd-seg__b" aria-pressed={duration === d.id} onClick={() => setDuration(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cb-poll__f">
        <button type="button" className="vd-switch" role="switch" aria-checked={multi} aria-describedby={`${id}-multi`} onClick={() => setMulti((m) => !m)}>
          <span className="vd-switch__track" aria-hidden="true">
            <span className="vd-switch__knob" />
          </span>
          Varias respuestas
        </button>
        <span className="cb-small" id={`${id}-multi`}>
          {multi ? "Cada uno marca las que quiera" : "Cada uno elige una"}
        </span>
      </div>

      {/* (no live region: it changes as the member types; «Publicar» moves the focus to the field, which reads it) */}
      {shown && (
        <p className="cb-small" id={errId}>
          {shown}
        </p>
      )}
      {error && (
        <p className="cb-small" role="alert">
          {error}
        </p>
      )}
      <div className="cb-row-acts">
        <button type="submit" className={BTN_PRI} disabled={busy}>
          {busy ? "Publicando…" : "Publicar encuesta"}
        </button>
        <button type="button" className={BTN} disabled={busy} onClick={() => onDone(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
