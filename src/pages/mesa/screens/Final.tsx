// La mesa · final (FinalV2): the gold LED, the result word with the site's G·E·P badge, our goals with
// «¿Le dio el pase alguien?» answered inline, «Antes de publicar» (what blocks it and what it updates),
// and «Publicar el acta» held for a second; then the acta is sealed and the effects light up.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { RESULT_WORD, resultLetter, resultTitle, type ResultLetter } from "../../../lib/derived/result";
import type { MesaEvent, MesaScreenProps } from "../types";
import { buzz } from "./hooks";
import { fixtureTitle, hhmm, onPitchAt } from "./model";
import { BackButton, Check, Screws } from "./parts";
import "./screens.css";

export const HOLD_MS = 1000;
/** The league's points for the result (G·E·P). */
const POINTS: Record<ResultLetter, number> = { G: 3, E: 1, P: 0 };
const isPlayerGoal = (e: MesaEvent) => e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick";

const TILES = [
  { label: "Estadísticas", d: "M4 19l5-6 4 3 7-9" },
  { label: "Ranking", d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z" },
  { label: "Logros", d: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" },
  { label: "Vota al MVP", d: "M9 11l3 3 8-8M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" },
];

export function Final({ view }: MesaScreenProps) {
  const { match, events, queue, field, bench, actions, nav } = view;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState("");
  const [prog, setProg] = useState(0);
  const [early, setEarly] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const published = match.published || doneAt !== null;

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);
  useEffect(() => {
    if (!confirmReopen) return;
    const t = setTimeout(() => setConfirmReopen(false), 4000);
    return () => clearTimeout(t);
  }, [confirmReopen]);

  const plays = events.filter((e) => !e.local).length;
  const goals = events.filter((e) => e.goal === "us" && !e.dupOf);
  // (a goal confirmed «sin asistencia» live isn't asked again)
  const asked = goals.filter((g) => isPlayerGoal(g) && !g.pendingScorer && !g.assistId && !g.assistReviewed);
  const open = asked.filter((g) => answers[g.id] === undefined).length;
  const players = [...field, ...bench];
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? view.nameOf(id);

  const blockers: string[] = [];
  if (queue.pending) blockers.push(`${queue.pending} ${queue.pending === 1 ? "jugada sigue" : "jugadas siguen"} en el móvil`);
  if (match.pendingDuplicates) blockers.push(`${match.pendingDuplicates} ${match.pendingDuplicates === 1 ? "duda" : "dudas"} entre anotadores`);
  if (queue.review.length) blockers.push(`${queue.review.length} por revisar`);
  const blocked = blockers.length > 0;

  const r = resultLetter(match.score.us, match.score.them);

  const publish = () => {
    setState("sending");
    actions.publish(answers).then(
      () => {
        buzz([30, 50, 30, 50, 160]);
        setDoneAt(Date.now());
        setState("idle");
      },
      () => setState("error"),
    );
  };
  const begin = () => {
    if (published || blocked || state === "sending" || timer.current) return;
    const t0 = Date.now();
    buzz(15);
    setEarly(false);
    setProg(1);
    timer.current = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - t0) / HOLD_MS) * 100));
      if (p >= 100) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setProg(0);
        publish();
      } else setProg(p);
    }, 30);
  };
  const end = () => {
    if (!timer.current) return;
    clearInterval(timer.current);
    timer.current = null;
    setProg(0);
    setEarly(true);
  };

  let hint: string;
  let hintCls = "fine";
  if (published) {
    hint = doneAt !== null ? `Publicada por ti a las ${hhmm(doneAt)}; solo un admin la reabre` : "Acta publicada; solo un admin la reabre";
    hintCls = "fine live";
  } else if (state === "sending") {
    hint = "Publicando…";
    hintCls = "fine live";
  } else if (state === "error") {
    hint = view.notice || "No se ha publicado. Inténtalo otra vez.";
    hintCls = "fine warn";
  } else if (blocked) {
    hint = `Antes: ${blockers[0]}`;
    hintCls = "fine warn";
  } else if (prog > 0) {
    hint = "Sigue… suelta para cancelar";
    hintCls = "fine live";
  } else if (early) {
    hint = "Mantenlo un segundo; no se ha publicado";
    hintCls = "fine warn";
  } else hint = "Mantén pulsado un segundo; queda a tu nombre";

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return;
    e.preventDefault();
    begin();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!e.repeat) begin();
  };

  const lit = published ? "nx lit" : "nx";
  return (
    <div className="col final">
      <div className="top">
        <BackButton label="Salir de la mesa" onClick={nav.exit} />
        <div className="ttl">
          <b>{fixtureTitle(match)}</b>
          {published ? (
            <span role="status"><span className="pubd"><Check size={13} width={3} />Final, acta publicada</span></span>
          ) : (
            <span><span className="prov"><i />Final provisional</span>la web ya lo muestra</span>
          )}
        </div>
      </div>

      <div className="box">
        <Screws at={10} />
        <div className="glass">
          <div className="sc">
            <div className="side"><span className="crest">MP</span><span className="code">PITI</span></div>
            <div className="dg" role="img" aria-label={`Final: Piti ${match.score.us}, ${match.rival} ${match.score.them}`}>
              <span className="d">{match.score.us}</span><s>:</s><span className="d">{match.score.them}</span>
            </div>
            <div className="side"><span className="crest r">{match.rivalInitials}</span><span className="code r">{match.rivalShort}</span></div>
          </div>
          {published ? (
            <div className="ln flip"><span className="plate"><Check size={13} width={3.2} />ACTA PUBLICADA</span></div>
          ) : (
            <div className="ln"><span className="half">FINAL</span><span className="clk">{match.clock.minute}′</span><span className="half">{plays} {plays === 1 ? "JUGADA" : "JUGADAS"}</span></div>
          )}
          <div className="prog" />
          {published && <span className="shine" />}
        </div>
      </div>

      <div className="res">
        <span className={`pt-res ${r}`} role="img" aria-label={`${r}, ${RESULT_WORD[r]}`}>{r}</span>
        <div className="rt">
          <div className="r1">
            <h1>{resultTitle(r)}</h1>
            {match.hasStandings && POINTS[r] > 0 && <span className="stamp">+{POINTS[r]} en la tabla</span>}
          </div>
          <p>Manchester Piti {match.score.us}–{match.score.them} {match.rival}</p>
        </div>
      </div>

      {goals.length > 0 && (
        <div className="gsheet">
          {goals.map((g) => {
            const answered = answers[g.id];
            const askable = asked.includes(g);
            const asking = askable && answered === undefined && !published;
            const a = g.assistName ?? (answered ? nameOf(answered) : "");
            const name = g.pendingScorer ? "Sin goleador" : g.type === "opponent_own_goal" ? "Autogol suyo" : (g.playerName ?? "Gol");
            const pool = players.filter((p) => p.id !== g.playerId && (g.elapsedSeconds == null ? field.includes(p) : onPitchAt(p.stints, g.elapsedSeconds)));
            return (
              <div key={g.id} className="g">
                <div className="r">
                  <span className="b"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0c1733" strokeWidth="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 5h-5L8 10z" /></svg></span>
                  <span className="m">{g.minute != null ? `${g.minute}′` : "–"}</span>
                  <span className="n">{name}</span>
                  {asking ? (
                    <span className="q">¿Le dio el pase alguien?</span>
                  ) : (
                    isPlayerGoal(g) && !g.pendingScorer && <span className={"a" + (a ? "" : " no") + (fresh === g.id ? " new" : "")}>{a ? `asist. ${a}` : "sin asistencia"}</span>
                  )}
                </div>
                {askable && !published && (
                  <div className={asking ? "askw" : "askw gone"}>
                    <div>
                      <div className="ask" role="group" aria-label={`¿Quién le dio el pase a ${name} en el ${g.minute ?? ""}′?`}>
                        {[...pool.map((p) => ({ id: p.id, label: p.name })), { id: "", label: "Nadie" }].map((o) => (
                          <button key={o.id || "nadie"} type="button" className={o.id ? "" : "nb"} tabIndex={asking ? 0 : -1} onClick={() => {
                            buzz(12);
                            setAnswers({ ...answers, [g.id]: o.id });
                            setFresh(g.id);
                          }}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="con">
        <div className="ch"><h2>Antes de publicar</h2><span>{published ? "Publicada" : blocked ? `Falta${blockers.length === 1 ? "" : "n"} ${blockers.length}` : "Listo para publicar"}</span></div>
        <div className="well" role="list" aria-label="Antes de publicar">
          {queue.pending ? (
            <div className="li warn" role="listitem"><span className="lamp" aria-hidden="true">!</span><span>{blockers[0]}</span><em>{queue.online ? "subiendo" : "sin red"}</em></div>
          ) : (
            <div className="li" role="listitem"><span className="lamp"><Check size={10} width={4} /></span><span>{plays} {plays === 1 ? "jugada subida" : "jugadas subidas"}</span><em>al día</em></div>
          )}
          {match.pendingDuplicates ? (
            <div className="li warn" role="listitem"><span className="lamp" aria-hidden="true">!</span><span>{match.pendingDuplicates} {match.pendingDuplicates === 1 ? "duda" : "dudas"} entre anotadores</span><em>en las jugadas</em></div>
          ) : (
            <div className="li" role="listitem"><span className="lamp"><Check size={10} width={4} /></span><span>Ninguna duda entre anotadores</span></div>
          )}
          {queue.review.length ? (
            <div className="li warn" role="listitem"><span className="lamp" aria-hidden="true">!</span><span>{queue.review.length} por revisar</span><em>en la mesa</em></div>
          ) : (
            <div className="li" role="listitem"><span className="lamp"><Check size={10} width={4} /></span><span>Nada por revisar</span><em>bandeja vacía</em></div>
          )}
          {open > 0 ? (
            <div className="li opt" role="listitem"><span className="lamp" aria-hidden="true">?</span><span>{open} {open === 1 ? "gol sin asistencia, opcional" : "goles sin asistencia, opcional"}</span></div>
          ) : (
            <div className="li fresh" role="listitem"><span className="lamp"><Check size={10} width={4} /></span><span>Asistencias completas</span></div>
          )}
        </div>
        <div className="cap">{published ? "Ya está actualizado" : "Al publicar se actualiza"}</div>
        <div className="fx" role="list" aria-label={published ? "Ya actualizado" : "Se actualiza al publicar"}>
          {TILES.map((t) => (
            <div key={t.label} className={lit} role="listitem">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.d} /></svg>
              {t.label}
              {published && <span className="tick"><Check size={10} width={4} color="#0c1733" /></span>}
            </div>
          ))}
        </div>
      </div>

      <div className="dock">
        <p className={hintCls} role="status">{hint}</p>
        {published ? (
          <div className="sealed" role="status"><span>Acta publicada</span><i><Check size={24} width={2.4} color="#0c1733" /></i></div>
        ) : (
          <button
            type="button"
            className={"hold" + (prog > 0 ? " on" : "") + (early && prog === 0 ? " no" : "")}
            aria-label="Publicar el acta: mantén pulsado un segundo"
            aria-disabled={blocked || state === "sending"}
            onPointerDown={onPointerDown}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
            onKeyDown={onKeyDown}
            onKeyUp={end}
            onBlur={end}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="bar" style={{ width: `${prog}%` }} />
            <span className="rg" style={{ background: `conic-gradient(#0c1733 ${prog}%, rgba(12,23,51,.16) 0)` }} />
            <span className="lb">Publicar el acta</span>
            <i><Check size={24} width={2.2} color="#FFC659" /></i>
          </button>
        )}
        <div className="fpair">
          {published ? (
            <button type="button" className="web" onClick={nav.acta}>
              Ver el acta en la web
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </button>
          ) : (
            <button type="button" className={confirmReopen ? "warn" : ""} onClick={() => {
              if (!confirmReopen) {
                setConfirmReopen(true);
                return;
              }
              setConfirmReopen(false);
              void actions.reopen();
            }}>{confirmReopen ? "¿Reabrir? Toca otra vez" : "Reabrir el partido"}</button>
          )}
          <button type="button" onClick={nav.cronica}>Ver las {plays} jugadas</button>
        </div>
      </div>
    </div>
  );
}
