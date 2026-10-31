// /vestuario/encuestas · the room as the canvas prototype draws it (SalaEncuestas.dc.html): the head says how many are
// open and what you still have to vote; «La del enlace» (/vestuario/encuestas/<id>: first of all, scrolled to and
// focused), «Abiertas» and «Cerradas esta semana»; each poll a card whose options are the vote (one answer: a tap
// votes; several: tick, then «Votar» / «Cambiar mi voto»), with the live share, «Gana X» / the tie once closed, the
// voters' shirts and «Quién votó qué», and «Cerrar ya» / «Borrar» (asked first) for the author or a captain. The side
// holds «Nueva encuesta» (writes.createPoll, the shape firestore.rules pollOk() checks; 3 open per author); on the
// phone it opens from a card. An empty room offers three one-tap questions that fill the form.
import "../../../styles/vestuario/encuestas.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type RefObject } from "react";
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
  pollFormProblem,
  pollOutcome,
  pollTally,
  validChoice,
  type Poll,
  type PollDurationId,
} from "../../../lib/derived/polls";
import { usePolls, usePollVotes } from "../live";
import { closePoll, createPoll, deletePoll, unvotePoll, votePoll } from "../writes";
import type { VxCtx } from "./ctx";
import {
  POLL_TEMPLATES,
  allKnown,
  composerLine,
  emptyHead,
  encuestasGroups,
  encuestasHead,
  encuestasVotersLine,
  openGroupMeta,
  optionAria,
  optionTag,
  pendingPolls,
  plural,
  pollStatus,
  resultText,
  sendHint,
} from "./encuestasView";
import { Ic, PShirt, ROOM_TITLE_ID, RoomHead, Tile } from "./kit";

/** Names shown before «Ver los N». */
const VOTERS_SHOWN = 5;
/** Voters' shirts before «+N» (the phone shows fewer: encuestas.css). */
const SHIRTS = 10;
const SHIRTS_PHONE = 7;
const BTN = "vd-glass vd-press nx-btn";
const BTN_PRI = `${BTN} nx-btn--pri`;
const BTN_DANGER = `${BTN} nx-btn--danger`;
const pollDomId = (id: string) => `ven-p-${id}`;
const smooth = () => typeof window !== "undefined" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
/** Shown: not hidden by the phone's layout (the composer and the «Nueva encuesta» card swap there). */
const shown = (el: HTMLElement | null) => !!el && el.getClientRects().length > 0;

type Squad = ReadonlyMap<string, { name: string; num: string }>;

interface Comp {
  q: string;
  opts: string[];
  duration: PollDurationId;
  multi: boolean;
  /** The validation problem «Publicar» found (cleared by the next change). */
  err: string;
  /** «Publicada…» after a publish (cleared by the next change). */
  ok: boolean;
}
const blank = (): Comp => ({ q: "", opts: ["", ""], duration: POLL_DEFAULT_DURATION, multi: false, err: "", ok: false });

export function EncuestasBlock({ c }: { c: VxCtx }) {
  const polls = usePolls(!!c.uid);
  const g = useMemo(() => encuestasGroups(polls.data, c.now, c.pollId), [polls.data, c.now, c.pollId]);
  const squad: Squad = useMemo(() => new Map((c.squad ?? []).map((s) => [s.id, { name: s.name, num: s.num }])), [c.squad]);
  // whether you voted in each poll (each card reads its own votes and says it here: the head counts what's left)
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const onVoted = useCallback((id: string, v: boolean) => setVoted((m) => (m[id] === v ? m : { ...m, [id]: v })), []);
  const pending = pendingPolls(g.allOpen, voted);
  const known = allKnown(g.allOpen, voted);
  const loading = polls.loading && !polls.data.length;
  const failed = !loading && polls.error && !polls.data.length;
  const ready = !loading && !failed;
  const head = encuestasHead({ loading, failed, open: g.allOpen, pending, known });
  const openMine = c.uid ? openPollsBy(polls.data, c.uid, c.now) : 0;
  const atLimit = openMine >= POLL_OPEN_PER_AUTHOR;
  const emptyOpen = ready && !g.allOpen.length;

  // polls deleted here (the address may still name one: that is no «ya no está»)
  const [gone, setGone] = useState<readonly string[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);

  // the composer: always on the side on a wide screen; on the phone it opens from the «Nueva encuesta» card
  const [comp, setComp] = useState<Comp>(blank);
  const [compOpen, setCompOpen] = useState(false);
  const [lit, setLit] = useState(false);
  const qRef = useRef<HTMLInputElement>(null);
  const newCard = useRef<HTMLButtonElement>(null);
  const focusQ = useRef(false);
  useEffect(() => {
    if (!focusQ.current || !qRef.current) return;
    focusQ.current = false;
    qRef.current.focus();
  });
  const openComp = (fill?: Partial<Comp>) => {
    if (atLimit || !c.me) return;
    if (fill) setComp({ ...blank(), ...fill });
    setCompOpen(true);
    setLit(true);
    focusQ.current = true;
  };
  // (back where the member was: the phone's card when the composer folds away; on a wide screen it stays)
  const backToCard = () => requestAnimationFrame(() => shown(newCard.current) && newCard.current?.focus());
  const published = (id: string | null) => {
    setComp({ ...blank(), ok: true });
    setCompOpen(false);
    setLit(false);
    setFresh(id);
    c.say("Publicada. Le llega un aviso a todo el equipo.");
    backToCard();
  };
  const cancel = () => {
    setComp(blank());
    setCompOpen(false);
    setLit(false);
    backToCard();
  };

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

  const deleted = (pollId: string) => {
    setGone((x) => [...x, pollId]);
    c.say("Encuesta borrada.");
    requestAnimationFrame(() => document.getElementById(ROOM_TITLE_ID)?.focus({ preventScroll: true }));
  };

  const card = (p: Poll) => <PollCard key={p.id} poll={p} c={c} squad={squad} named={p.id === c.pollId} fresh={p.id === fresh} onVoted={onVoted} onDeleted={() => deleted(p.id)} />;
  const groups = [
    g.focus && { id: "f", h: "La del enlace", meta: isPollOpen(g.focus, c.now) ? "Abierta" : "Ya está cerrada, pero aquí la tienes", polls: [g.focus] },
    g.open.length > 0 && { id: "o", h: "Abiertas", meta: openGroupMeta(pending.length, known), polls: g.open },
    g.closed.length > 0 && { id: "c", h: "Cerradas esta semana", meta: "Las de los últimos 7 días", polls: g.closed },
  ].filter((x) => !!x);
  const missing = g.missing && ready && !(c.pollId && gone.includes(c.pollId));

  return (
    <section className="ven" aria-labelledby={ROOM_TITLE_ID}>
      <RoomHead room="encuestas" icon="poll" kick="Encuestas · el equipo pregunta y vota" title={head.title} sub={head.sub} />

      {missing && (
        <p className="ven-gone" role="status">
          <Tile icon="trash" />
          Esa encuesta ya no está: la borraron.
        </p>
      )}

      <div className="ve-cols">
        <div className="ve-stack">
          {loading && (
            <>
              <p className="nx-meta" role="status">
                Mirando las encuestas…
              </p>
              <div className="ven-skel" aria-hidden="true" />
              <div className="ven-skel" aria-hidden="true" />
            </>
          )}

          {failed && (
            <div className="ve-empty" role="alert">
              <Tile icon="warn" warn />
              <h2>No se pudieron leer las encuestas</h2>
              <p>Prueba a recargar dentro de un rato. Tus votos están guardados.</p>
              <div className="ve-acts">
                <button type="button" className={BTN_PRI} onClick={() => window.location.reload()}>
                  <Ic name="rota" />
                  Volver a intentarlo
                </button>
              </div>
            </div>
          )}

          {emptyOpen && (
            <div className="ve-empty ven-empty">
              <Tile icon="poll" />
              <h2>{emptyHead(polls.data.length > 0)}</h2>
              <p>Una pregunta, de 2 a 6 respuestas y una hora de cierre. Le llega un aviso a todo el equipo y todos ven quién votó qué. Empieza con una de estas:</p>
              <div className="ve-quick" role="group" aria-label="Preguntas para empezar">
                {POLL_TEMPLATES.map((t) => (
                  <button key={t.q} type="button" className="vd-glass vd-press ve-chip ven-tpl" disabled={atLimit || !c.me} onClick={() => openComp({ q: t.q, opts: [...t.opts], duration: t.duration, multi: t.multi })}>
                    <Ic name="plus" />
                    {t.q}
                  </button>
                ))}
              </div>
              <div className="ve-acts">
                <button type="button" className={BTN_PRI} disabled={atLimit || !c.me} onClick={() => openComp()}>
                  <Ic name="edit" />
                  Escribir mi pregunta
                </button>
              </div>
            </div>
          )}

          {ready &&
            groups.map((gr, i) => (
              <section key={gr.id} className={`nx-sec${i === 0 && !emptyOpen ? " nx-sec--first" : ""}`} aria-labelledby={`ven-g-${gr.id}`}>
                <div className="nx-sec__head">
                  <h2 className="nx-h3" id={`ven-g-${gr.id}`}>
                    {gr.h}
                  </h2>
                  <p className="nx-meta">{gr.meta}</p>
                </div>
                <div className="ve-stack">{gr.polls.map(card)}</div>
              </section>
            ))}
        </div>

        <div className="ve-side ve-stack">
          {ready && !compOpen && !emptyOpen && (
            <button ref={newCard} type="button" className="vd-glass vd-press ven-new" onClick={() => openComp()} disabled={atLimit || !c.me}>
              <Tile icon="plus" />
              <span className="ven-new__t">
                <b>Nueva encuesta</b>
                <span>{atLimit ? `Ya tienes ${POLL_OPEN_PER_AUTHOR} abiertas. Cierra una para abrir otra.` : "Pregunta algo al equipo · le llega a todos"}</span>
              </span>
              <Ic name="chevR" />
            </button>
          )}
          {ready && <Composer c={c} comp={comp} setComp={setComp} open={compOpen} lit={lit} openMine={openMine} atLimit={atLimit} qRef={qRef} onPublished={published} onCancel={cancel} />}
        </div>
      </div>
    </section>
  );
}

function PollCard({ poll, c, squad, named, fresh, onVoted, onDeleted }: { poll: Poll; c: VxCtx; squad: Squad; named: boolean; fresh: boolean; onVoted: (id: string, voted: boolean) => void; onDeleted: () => void }) {
  const me = c.me;
  const votes = usePollVotes(poll.id);
  const open = isPollOpen(poll, c.now);
  const status = pollStatus(poll, c.now);
  const tally = useMemo(() => pollTally(poll, votes.data), [poll, votes.data]);
  const outcome = pollOutcome(tally);
  const myVote = votes.data.find((v) => v.uid === c.uid);
  const mine = useMemo(() => (myVote ? validChoice(poll, myVote.optionIds) : []), [poll, myVote]);
  useEffect(() => {
    if (!votes.loading && !votes.error) onVoted(poll.id, mine.length > 0);
  }, [votes.loading, votes.error, mine.length, poll.id, onVoted]);
  // what the member is picking (null: what they voted, live)
  const [picked, setPicked] = useState<string[] | null>(null);
  const choice = picked ?? mine;
  const sameAs = (ids: readonly string[]) => ids.length === mine.length && ids.every((x) => mine.includes(x));
  const same = sameAs(choice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [whoOpen, setWhoOpen] = useState(false);
  const [allVoters, setAllVoters] = useState(false);
  const [asking, setAsking] = useState(false);
  const manage = canManagePoll(poll, c.uid, c.admin);
  const id = useId();
  const qId = `${id}-q`;
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
    if (!me || busy || sameAs(ids)) return;
    if (!ids.length) {
      // several answers, nothing ticked: the vote is taken back
      if (!mine.length) return;
      setPicked([]);
      const ok = await run(() => unvotePoll(me, poll.id));
      setPicked(null);
      if (ok) c.say("Voto quitado.");
      return;
    }
    setPicked(ids);
    const ok = await run(() => votePoll(me, poll, ids));
    setPicked(null);
    if (ok) c.say(`Voto guardado: «${joinEs(validChoice(poll, ids).map(label))}».`);
  };
  const tap = (optionId: string) => {
    if (!open || busy || !me) return;
    // one answer: the tap is the vote; several: the tap ticks, «Votar» saves
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

  // the people who voted (a vote for nothing this poll still has doesn't count), with their name and shirt
  const voters = votes.data
    .map((v) => {
      const ids = validChoice(poll, v.optionIds);
      const sq = v.playerId ? squad.get(v.playerId) : undefined;
      return { uid: v.uid, me: v.uid === c.uid, name: sq?.name ?? v.name, num: sq?.num ?? "", opts: ids.map(label).join(", "), n: ids.length };
    })
    .filter((v) => v.n > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const shirts = [...voters].sort((a, b) => (Number(a.num) || 99) - (Number(b.num) || 99));
  const shownVoters = allVoters ? voters : voters.slice(0, VOTERS_SHOWN);
  // the author's shirt: yours, or the one he signed his own vote with
  const authorPid = poll.authorUid === c.uid ? c.playerId : (votes.data.find((v) => v.uid === poll.authorUid)?.playerId ?? null);
  const authorNum = (authorPid && squad.get(authorPid)?.num) || "";
  const mineAuthor = !!c.uid && poll.authorUid === c.uid;
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
  const adminLab = c.admin && !mineAuthor ? "Capitán" : "Tu encuesta";

  return (
    <article
      className={`${open ? "vd-glass vd-glass--deep ve-card ven-poll" : "ven-poll is-closed"}${named ? " is-focus" : ""}${fresh ? " is-new" : ""}`}
      id={pollDomId(poll.id)}
      aria-labelledby={qId}
      tabIndex={named ? -1 : undefined}
    >
      <div className="ven-top">
        <PShirt n={authorNum} />
        <p className="ven-by">
          De <b>{poll.authorName}</b>
          {mineAuthor && <span className="ve-you">tú</span>}
        </p>
        <span className={`ve-st ${status.cls}`}>
          <Ic name={open ? "clock" : "lock"} />
          {status.text}
        </span>
        {poll.multi && <span className="ve-st is-off">Varias respuestas</span>}
      </div>
      {named && (
        <p className="ven-flag">
          <Ic name="link" className="nx-ic--s" />
          La encuesta del enlace que abriste
        </p>
      )}
      <h3 className={`ven-q${open ? "" : " is-closed"}`} id={qId}>
        {poll.question}
      </h3>
      {!open && (
        <p className={`ven-res${outcome.kind === "none" ? " is-none" : ""}`}>
          <Ic name="check" />
          {resultText(poll, outcome)}
        </p>
      )}
      <div className="ven-opts" role={poll.multi ? "group" : "radiogroup"} aria-labelledby={qId} onKeyDown={poll.multi ? undefined : rove}>
        {tally.rows.map((r, i) => {
          const on = choice.includes(r.id);
          const tag = optionTag(r.id, outcome);
          const win = outcome.kind === "winner" && outcome.ids[0] === r.id;
          return (
            <button
              key={r.id}
              ref={(el) => {
                optRefs.current[i] = el;
              }}
              type="button"
              role={poll.multi ? "checkbox" : "radio"}
              className={`ven-opt${poll.multi ? " is-sq" : ""}${win ? " is-win" : ""}`}
              aria-checked={on}
              aria-label={optionAria(r.label, tag, r.count, r.pct, mine.includes(r.id))}
              aria-disabled={busy || !me ? true : undefined}
              disabled={!open}
              tabIndex={poll.multi || i === tabStop ? 0 : -1}
              style={{ "--p": `${tally.voters ? Math.max(r.pct, 2) : 0}%` } as CSSProperties}
              onClick={() => tap(r.id)}
            >
              <span className="ven-opt__fill" aria-hidden="true" />
              <span className="ven-opt__dot" aria-hidden="true">
                <Ic name="check" />
              </span>
              <span className="ven-opt__t" aria-hidden="true">
                {r.label}
                {tag && <em className="ven-tag">{tag}</em>}
              </span>
              <span className="ven-opt__v" aria-hidden="true">
                <b>{r.pct} %</b> · {plural(r.count, "voto", "votos")}
              </span>
            </button>
          );
        })}
      </div>
      {open && poll.multi && (
        <div className="ven-send">
          <button type="button" className={BTN_PRI} disabled={!me || busy || same || (!choice.length && !mine.length)} onClick={() => void save(choice)}>
            <Ic name="check" />
            {busy ? "Guardando…" : mine.length ? "Cambiar mi voto" : "Votar"}
          </button>
          <span className="nx-meta">{sendHint(!same, choice.length, mine.length)}</span>
        </div>
      )}

      <div className="ven-voters">
        {voters.length > 0 && (
          <span className="ven-shirts" aria-hidden="true">
            {shirts.slice(0, SHIRTS).map((v) => (
              <PShirt key={v.uid} n={v.num} />
            ))}
            {shirts.length > SHIRTS && <span className="ven-more ven-more--wide">+{shirts.length - SHIRTS}</span>}
            {shirts.length > SHIRTS_PHONE && <span className="ven-more ven-more--phone">+{shirts.length - SHIRTS_PHONE}</span>}
          </span>
        )}
        <p className="ven-line" role={votes.error ? "alert" : undefined}>
          {votersLine}
        </p>
        {voters.length > 0 && (
          <button type="button" className="nx-lnk" aria-expanded={whoOpen} aria-controls={`${id}-who`} onClick={() => setWhoOpen((x) => !x)}>
            Quién votó qué
          </button>
        )}
      </div>
      {whoOpen && voters.length > 0 && (
        <div className="ven-who" id={`${id}-who`}>
          <ul className="ve-list" id={`${id}-voters`} aria-label={`Quién votó qué en «${poll.question}»`}>
            {shownVoters.map((v) => (
              <li key={v.uid} className={`ve-row${v.me ? " is-me" : ""}`}>
                <PShirt n={v.num} />
                <span className="ve-row__t">
                  <b>
                    {v.name}
                    {v.me && <span className="ve-you">tú</span>}
                  </b>
                  <span>{v.opts}</span>
                </span>
              </li>
            ))}
          </ul>
          {voters.length > VOTERS_SHOWN && (
            <button type="button" className="nx-lnk" aria-expanded={allVoters} aria-controls={`${id}-voters`} onClick={() => setAllVoters((x) => !x)}>
              {allVoters ? "Ver menos" : `Ver los ${voters.length}`}
            </button>
          )}
        </div>
      )}

      {manage && !asking && (
        <div className="ven-admin" role="group" aria-label={adminLab}>
          <span className="ven-admin__k" aria-hidden="true">
            {adminLab}
          </span>
          {open && (
            <button type="button" className={BTN} disabled={busy} onClick={() => void close()}>
              <Ic name="lock" />
              Cerrar ya
            </button>
          )}
          <button ref={borrar} type="button" className={BTN_DANGER} disabled={busy} onClick={() => setAsking(true)}>
            <Ic name="trash" />
            Borrar
          </button>
        </div>
      )}
      {manage && asking && (
        <div
          className="ve-confirm"
          role="alertdialog"
          aria-label="Borrar la encuesta"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setAsking(false);
          }}
        >
          <p>¿Borrar la encuesta? Se va para todo el equipo, con sus votos.</p>
          <div className="ve-acts">
            <button ref={yes} type="button" className={BTN_DANGER} disabled={busy} onClick={() => void remove()}>
              {busy ? "Borrando…" : "Sí, borrarla"}
            </button>
            <button type="button" className={BTN} disabled={busy} onClick={() => setAsking(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="ve-err" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function Composer({
  c,
  comp,
  setComp,
  open,
  lit,
  openMine,
  atLimit,
  qRef,
  onPublished,
  onCancel,
}: {
  c: VxCtx;
  comp: Comp;
  setComp: (f: (prev: Comp) => Comp) => void;
  open: boolean;
  lit: boolean;
  openMine: number;
  atLimit: boolean;
  qRef: RefObject<HTMLInputElement | null>;
  onPublished: (id: string | null) => void;
  onCancel: () => void;
}) {
  const me = c.me;
  const [busy, setBusy] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const id = useId();
  const optRefs = useRef<(HTMLInputElement | null)[]>([]);
  const durRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusOpt = useRef<number | null>(null);
  useEffect(() => {
    if (focusOpt.current === null) return;
    optRefs.current[focusOpt.current]?.focus();
    focusOpt.current = null;
  }, [comp.opts.length]);

  // any change clears the last «Publicar»'s problem and its «Publicada»
  const change = (patch: Partial<Comp>) => {
    setApiErr("");
    setComp((p) => ({ ...p, ...patch, err: "", ok: false }));
  };
  const form = { question: comp.q, options: comp.opts, multi: comp.multi, duration: comp.duration };
  // Which field the problem is about: with two good options in place, only the question's own is left.
  const questionProblem = pollFormProblem({ ...form, options: ["1", "2"] }, 0) !== null;
  const field = comp.err ? (questionProblem ? "question" : "options") : null;
  const errId = `${id}-err`;
  const filled = comp.opts.filter((o) => o.trim()).length;
  const durIndex = Math.max(
    0,
    POLL_DURATIONS.findIndex((d) => d.id === comp.duration),
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setApiErr("");
    const problem = pollFormProblem(form, openMine);
    if (problem) {
      setComp((p) => ({ ...p, err: problem, ok: false }));
      // (the first field to fix takes the focus; it reads the error through aria-describedby)
      const f = pollFormProblem({ ...form, options: ["1", "2"] }, 0) !== null ? "question" : "options";
      if (f === "question") qRef.current?.focus();
      else (optRefs.current[comp.opts.findIndex((o) => !o.trim())] ?? optRefs.current[0])?.focus();
      return;
    }
    if (!me || busy) return;
    setBusy(true);
    try {
      const ref = await createPoll(me, form, serverNow());
      onPublished(ref.id);
    } catch (err) {
      setApiErr(apiError(err));
    } finally {
      setBusy(false);
    }
  };
  const setOption = (i: number, v: string) => change({ opts: comp.opts.map((x, j) => (j === i ? v : x)) });
  const addOption = () => {
    if (comp.opts.length >= POLL_MAX_OPTIONS) return;
    focusOpt.current = comp.opts.length;
    change({ opts: [...comp.opts, ""] });
  };
  const removeOption = (i: number) => {
    if (comp.opts.length <= POLL_MIN_OPTIONS) return;
    focusOpt.current = Math.max(0, i - 1);
    change({ opts: comp.opts.filter((_, j) => j !== i) });
  };
  // «Se cierra en» is a radio group: the arrows move and choose
  const durKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = POLL_DURATIONS.length;
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = (i + step + n) % n;
    change({ duration: POLL_DURATIONS[to].id });
    durRefs.current[to]?.focus();
  };

  return (
    <section className={`vd-glass vd-glass--deep ve-card ven-comp${lit ? " is-lit" : ""}${open ? " is-open" : ""}`} aria-labelledby={`${id}-h`}>
      <div className="ven-comp__h">
        <Tile icon="plus" />
        <div>
          <h2 id={`${id}-h`}>Nueva encuesta</h2>
          <p>{composerLine(openMine, POLL_OPEN_PER_AUTHOR)}</p>
        </div>
      </div>

      {atLimit ? (
        <div className="ven-limit">
          <p className="ve-err" role="status">
            Ya tienes {POLL_OPEN_PER_AUTHOR} encuestas abiertas. Cierra una para abrir otra.
          </p>
          <button type="button" className={`vd-glass nx-btn nx-btn--pri`} disabled>
            Nueva encuesta
          </button>
        </div>
      ) : (
        <form className="ve-form" onSubmit={(e) => void submit(e)} noValidate aria-labelledby={`${id}-h`} aria-describedby={comp.err && !field ? errId : undefined}>
          <label className="ve-lab" htmlFor={`${id}-q`}>
            <span className="ven-lab">
              <span>Pregunta</span>
              <span className={`ve-count${comp.q.length > POLL_QUESTION_MAX ? " is-over" : ""}`} id={`${id}-qn`}>
                {comp.q.length}/{POLL_QUESTION_MAX}
              </span>
            </span>
            <input
              ref={qRef}
              className="ve-in"
              id={`${id}-q`}
              type="text"
              value={comp.q}
              maxLength={POLL_QUESTION_MAX}
              placeholder="¿Cena el viernes?"
              autoComplete="off"
              aria-invalid={field === "question"}
              aria-describedby={field === "question" ? `${errId} ${id}-qn` : `${id}-qn`}
              onChange={(e) => change({ q: e.target.value })}
            />
          </label>

          <div className="ve-lab" role="group" aria-labelledby={`${id}-oh`}>
            <span className="ven-lab" id={`${id}-oh`}>
              <span>
                Opciones · de {POLL_MIN_OPTIONS} a {POLL_MAX_OPTIONS}
              </span>
              <span className="ve-count">
                {filled} de {POLL_MAX_OPTIONS}
              </span>
            </span>
            <div className="ven-os">
              {comp.opts.map((o, i) => (
                <div className="ven-o" key={i}>
                  <label className="ven-o__n" htmlFor={`${id}-o${i}`}>
                    <span className="ven-sr">Opción </span>
                    {i + 1}
                  </label>
                  <input
                    ref={(el) => {
                      optRefs.current[i] = el;
                    }}
                    className="ve-in"
                    id={`${id}-o${i}`}
                    type="text"
                    value={o}
                    maxLength={POLL_OPTION_MAX}
                    placeholder={i === 0 ? "Sí" : i === 1 ? "No" : `Opción ${i + 1}…`}
                    autoComplete="off"
                    aria-invalid={field === "options"}
                    aria-describedby={field === "options" ? errId : undefined}
                    onChange={(e) => setOption(i, e.target.value)}
                  />
                  <span className="ven-o__end">
                    {o.length >= 30 && <span className={`ve-count${o.length > POLL_OPTION_MAX ? " is-over" : ""}`}>{`${o.length}/${POLL_OPTION_MAX}`}</span>}
                    {comp.opts.length > POLL_MIN_OPTIONS && (
                      <button type="button" className="ven-rm" aria-label={`Quitar la opción ${i + 1}`} onClick={() => removeOption(i)}>
                        <Ic name="close" />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {comp.opts.length < POLL_MAX_OPTIONS && (
              <button type="button" className={`${BTN} ven-add`} onClick={addOption}>
                <Ic name="plus" />
                Añadir opción
              </button>
            )}
          </div>

          <div className="ve-lab" role="group" aria-labelledby={`${id}-dur`}>
            <span id={`${id}-dur`}>Se cierra en</span>
            <div className="vd-glass vd-seg nx-seg" role="radiogroup" aria-labelledby={`${id}-dur`} style={{ "--n": POLL_DURATIONS.length, "--i": durIndex } as CSSProperties}>
              <span className="vd-shelf__bead" aria-hidden="true" />
              {POLL_DURATIONS.map((d, i) => (
                <button
                  key={d.id}
                  ref={(el) => {
                    durRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  className="vd-seg__b"
                  aria-checked={comp.duration === d.id}
                  tabIndex={comp.duration === d.id ? 0 : -1}
                  onClick={() => change({ duration: d.id })}
                  onKeyDown={(e) => durKey(e, i)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ven-tog">
            <button type="button" className="ve-tog" aria-pressed={comp.multi} onClick={() => change({ multi: !comp.multi })}>
              <span className="ven-tog__s">
                <span>Varias respuestas</span>
                <small>{comp.multi ? "Cada uno marca las que quiera" : "Cada uno elige una"}</small>
              </span>
              <span className="ve-tog__t" aria-hidden="true" />
            </button>
          </div>

          {comp.err && (
            <p className="ve-err" id={errId} role="alert">
              {comp.err}
            </p>
          )}
          {apiErr && (
            <p className="ve-err" role="alert">
              {apiErr}
            </p>
          )}
          {comp.ok && (
            <p className="ven-ok" role="status">
              <Ic name="check" />
              Publicada. Le llega un aviso a todo el equipo.
            </p>
          )}

          <div className="ve-acts">
            <button type="submit" className={BTN_PRI} disabled={busy || !me}>
              <Ic name="send" />
              {busy ? "Publicando…" : "Publicar encuesta"}
            </button>
            <button type="button" className={BTN} disabled={busy} onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
