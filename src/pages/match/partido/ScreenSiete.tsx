// «El partido» · El siete (P- boards, place-siete): one glass pitch for the whole match day, driven by the
// moviola's minute — the seven before the whistle with the bench and who is not here, the pitch minute by minute
// while it is played (a change the playhead crosses walks in, a mark it passes pops), and once played «Quién hizo
// qué» or «Los minutos». Beside it the player panel (never empty on desktop), the bench or who is off the pitch,
// and every player's stints. The logic is pure in sieteModel.ts.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useLocation } from "@tanstack/react-router";
import { useClubData, type ClubMatch } from "../../../lib/clubData";
import { useSeason } from "../../../context/SeasonContext";
import { absentBadge, madridDate, matchDay } from "../../../lib/derived/absences";
import { toBePlayed } from "../../../lib/derived/kickoff";
import { mvpWinners, voteLeft } from "../../../lib/vestuario";
import { parseMatchLineup } from "../../../lib/matchLineup";
import { madridTime } from "../../../lib/derived/madrid";
import { useAbsences, useAvailability, useMatchScorers, usePlayerLinks } from "../../vestuario/live";
import { useMatchBoard } from "../../pizarra/useMatchBoard";
import type { Participation } from "../../../../functions/src/matchEngine";
import type { PageCtx } from "./ctx";
import { Go, Icon, Tee } from "./bits";
import { crossingOf, outOf, seasonCountsOf, sieteView, tagIcon, type StintView, type TagView } from "./sieteModel";
import "./siete.css";

const WALK_MS = 1100;
const POP_MS = 1400;
const WEEKDAY = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "Europe/Madrid" });

/** «el sábado a las 21:40» («hoy a las 18:05»): when the seven came out of the pizarra. */
function publishedText(match: ClubMatch, now: number): string | null {
  const l = parseMatchLineup((match as ClubMatch & { lineup?: unknown }).lineup);
  if (!l || !Number.isFinite(l.setAt) || l.setAt <= 0) return null;
  const day = madridDate(l.setAt) === madridDate(now) ? "hoy" : `el ${WEEKDAY.format(l.setAt)}`;
  return `${day} a las ${madridTime(l.setAt)}`;
}

const SVG = { viewBox: "0 0 24 24", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
function TagGlyph({ k }: { k: TagView["k"] }) {
  const g = tagIcon(k);
  if (g === "gol")
    return (
      <svg {...SVG}>
        <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.2 3.6 2.6-1.4 4.2H9.8L8.4 9.8Zm0-4.2v4.2m3.6 2.6 4.1-1.2M14.2 14l2.5 3.4M9.8 14l-2.5 3.4M8.4 9.8 4.3 8.6" />
      </svg>
    );
  if (g === "asis")
    return (
      <svg {...SVG}>
        <path d="M6 18 18 6m0 0H9m9 0v9" />
      </svg>
    );
  if (g === "parada")
    return (
      <svg {...SVG}>
        <path d="M8 21h8l1.5-7V7.5a1.5 1.5 0 0 0-3 0V11V5a1.5 1.5 0 0 0-3 0v6V4.5a1.5 1.5 0 0 0-3 0V12l-1.6-1.8a1.5 1.5 0 0 0-2.3 1.9L8 17Z" />
      </svg>
    );
  if (g === "cambio")
    return (
      <svg {...SVG}>
        <path d="M4 8h13l-3-3m6 11H7l3 3" />
      </svg>
    );
  if (g === "star")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="currentColor" />
      </svg>
    );
  if (g === "pen") return <Icon name="whistle" className="" />;
  return null;
}
function Tags({ tags, className, style }: { tags: TagView[]; className: string; style?: CSSProperties }) {
  return (
    <span className={`vd-tags ${className}`} style={style}>
      {tags.map((t) => (
        <span key={t.key} className={`vd-tag ${t.cls}`} role="img" aria-label={t.label}>
          <TagGlyph k={t.k} />
          {t.text}
        </span>
      ))}
    </span>
  );
}

function StintRow({ s, sm, kit }: { s: StintView; sm: boolean; kit: PageCtx["kit"] }) {
  return (
    <li className={`ps-st__r${s.cls ? ` ${s.cls}` : ""}${sm ? " ps-st__r--sm" : ""}`}>
      <Tee kit={kit} num={s.num} className="ps-st__tee" />
      <p className="ps-st__t">
        <b>{s.name}</b>
        {s.me && <span className="ps-me2">Tú</span>}
        {s.mvp && <span className="vd-tag vd-tag--gold ps-mvptag">MVP</span>}
        <span>{s.sub}</span>
      </p>
      <span className="ps-st__m">{s.minText}</span>
      <span className="ps-st__tr" role="img" aria-label={s.label}>
        <i className="ps-st__half" />
        {s.ghosts.map((g, i) => (
          <i key={`g${i}`} className="ps-st__ghost" style={{ left: `${g.l}%`, width: `${g.w}%` }} />
        ))}
        {s.fills.map((g, i) => (
          <i key={`f${i}`} className="ps-st__fill" style={{ left: `${g.l}%`, width: `${g.w}%` }} />
        ))}
        {s.dots.map((d, i) => (
          <i key={`d${i}`} className={`ps-st__dot ${d.cls}`} style={{ left: `${d.left}%` }} />
        ))}
        {s.headOn && <i className="ps-st__head" style={{ left: `${s.headPct}%` }} />}
      </span>
    </li>
  );
}

export function ScreenSiete({ c }: { c: PageCtx }) {
  const { match, viewer, fase } = c;
  const loc = useLocation();
  const search = loc.search as Record<string, unknown>;
  const [sel, setSel] = useState<string | null>(() => (typeof search.ficha === "string" ? search.ficha : null));
  const [view, setView] = useState<"quien" | "min">(() => (typeof search.vista === "string" && /^min/.test(search.vista) ? "min" : "quien"));
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ---- the reads: the season (its name, the squad, its published actas), the convocatoria's answers and the
  // absences, who keeps la mesa, the official board (members only; a fan reads none of them)
  const { players } = useClubData();
  const { seasons } = useSeason();
  const seasonName = seasons.find((s) => s.id === match.seasonId)?.name ?? "";
  const before = c.pre || fase === "aplazado";
  const reads = viewer.member && before;
  const answers = useAvailability(reads ? match.id : undefined);
  const absences = useAbsences(madridDate(c.now), reads);
  const scorers = useMatchScorers(reads ? match.id : undefined);
  const links = usePlayerLinks(reads);
  const boardId = useMatchBoard(match.seasonId, match.id, toBePlayed(match, c.now), viewer.member);

  const { lineup, nameOf, kickMs } = c;
  const out = useMemo(() => {
    if (!reads) return [];
    const called = new Set([...lineup.slots.map((s) => s.id), ...lineup.bench]);
    const squad = players.filter((p) => !p.archived && !!match.seasonId && (p.seasons ?? []).includes(match.seasonId)).map((p) => p.id);
    const day = matchDay(kickMs);
    const mesaUids = new Set(scorers.data);
    const mesa = new Set(links.data.filter((l) => mesaUids.has(l.uid)).map((l) => l.playerId));
    // (the captain's «no convocados» in his order, then everyone else by name)
    const nc = lineup.notCalled;
    const rank = (id: string) => (nc.includes(id) ? nc.indexOf(id) : nc.length);
    const ordered = [...squad].sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b), "es"));
    return outOf({
      squad: ordered,
      called,
      notCalled: lineup.notCalled,
      answers: answers.data,
      mesa,
      absentOf: (a) => {
        const b = absentBadge(a, absences.data, day);
        return b ? b.replace(" · ", " ") : null;
      },
      meAtMesa: viewer.anotador ? viewer.playerId : null,
    });
  }, [reads, lineup, players, match.seasonId, kickMs, nameOf, scorers.data, links.data, answers.data, absences.data, viewer.anotador, viewer.playerId]);

  const mvpIds = useMemo(() => (fase === "despues" ? mvpWinners(match, c.mvp, c.now) : []), [fase, match, c.mvp, c.now]);
  const seasonOf = useCallback((id: string) => seasonCountsOf(c.matches, match, id), [c.matches, match]);

  // ---- the playhead crossing a change or a mark: the new man walks in, the old one walks off; a mark pops
  const m = c.played ? c.minute : 0;
  type Motion = { walks: { inId: string; outId: string; until: number }[]; fresh: { m: number; until: number }[] };
  const [motion, setMotion] = useState<Motion>({ walks: [], fresh: [] });
  const last = useRef<{ m: number | null; fase: string | null }>({ m: null, fase: null });
  useLayoutEffect(() => {
    const prev = last.current;
    last.current = { m, fase };
    if (prev.fase !== fase) {
      setMotion((x) => (x.walks.length || x.fresh.length ? { walks: [], fresh: [] } : x));
      return;
    }
    if (!c.played || prev.m == null || prev.m === m) return;
    const cr = crossingOf(c.tl, c.plays, prev.m, m);
    if (!cr.walks.length && !cr.fresh.length) return;
    const now = Date.now();
    setMotion((x) => ({
      walks: [...x.walks.filter((w) => w.until > now && !cr.walks.some((n) => n.inId === w.inId)), ...cr.walks.map((w) => ({ ...w, until: now + WALK_MS }))],
      fresh: [...x.fresh.filter((f) => f.until > now), ...cr.fresh.map((mm) => ({ m: mm, until: now + POP_MS }))],
    }));
  }, [m, fase, c.played, c.tl, c.plays]);
  useEffect(() => {
    const all = [...motion.walks.map((w) => w.until), ...motion.fresh.map((f) => f.until)];
    if (!all.length) return;
    const t = window.setTimeout(
      () => {
        const now = Date.now();
        setMotion((x) => ({ walks: x.walks.filter((w) => w.until > now), fresh: x.fresh.filter((f) => f.until > now) }));
      },
      Math.max(16, Math.min(...all) - Date.now() + 10),
    );
    return () => window.clearTimeout(t);
  }, [motion]);
  const walking = useMemo(() => new Map(motion.walks.map((w) => [w.inId, w.outId])), [motion.walks]);
  const fresh = useMemo(() => motion.fresh.map((f) => f.m), [motion.fresh]);

  const ledger = (match.ledger as Record<string, Participation> | undefined) ?? null;
  const v = sieteView({
    fase,
    minute: c.minute,
    edge: c.edge,
    duration: c.duration,
    pre: c.pre,
    live: c.live,
    played: c.played,
    plays: c.plays,
    tl: c.tl,
    lineup: c.lineup,
    result: c.result,
    captain: c.captain,
    people: c.people,
    viewer,
    mvpIds,
    sel,
    view,
    fresh,
    walking,
    ledger: ledger && Object.keys(ledger).length ? ledger : null,
    partial: (match as ClubMatch & { analysisCoverage?: unknown }).analysisCoverage === "partial",
    publishedAt: c.lineup.published ? publishedText(match, c.now) : null,
    out,
    seasonOf,
    seasonName,
    jornada: c.jornada,
    voteLeft: typeof match.voteClosesAt === "number" ? voteLeft(match.voteClosesAt, c.now) : "",
  });

  const pick = (id: string) => setSel((s) => (s === id ? null : id));
  const showView = (nv: "quien" | "min") => setView(nv);
  const segKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let nv: "quien" | "min" = v.view === "min" ? "quien" : "min";
    if (e.key === "Home") nv = "quien";
    if (e.key === "End") nv = "min";
    setView(nv);
    segRefs.current[nv === "min" ? 1 : 0]?.focus();
  };
  // (only with this match's official board: a played match with only the season's plan has none)
  const pizarraHref = boardId ? `/pizarra?tablero=${encodeURIComponent(boardId)}` : null;
  const card = v.card;

  const changes = (extra: boolean) => (
    <section className={`ps-changes${extra ? " ps-changes--panel" : ""}`} aria-labelledby={extra ? "ps-ch-t2" : "ps-ch-t"}>
      <h3 className="ps-k" id={extra ? "ps-ch-t2" : "ps-ch-t"}>
        {v.chT}
      </h3>
      <p className="ps-note ps-changes__sub">{v.chSub}</p>
      <div className="ps-axis ps-axis--sm" aria-hidden="true">
        <span>0′</span>
        <span>{v.half}′</span>
        <span>{c.duration}′</span>
      </div>
      <ol className="ps-st ps-st--sm">
        {v.stints.map((s) => (
          <StintRow key={s.id} s={s} sm kit={c.kit} />
        ))}
      </ol>
    </section>
  );

  return (
    <section className={`pp-place pp-place--siete${v.cls ? ` ${v.cls}` : ""}`} aria-labelledby="ps-h">
      <header className="pp-place__head">
        <div>
          <h2 id="ps-h">{v.h}</h2>
          <p>{v.sub}</p>
        </div>
        {v.hasSeg && (
          <div className="vd-glass vd-seg ps-seg" role="radiogroup" aria-label="Cómo ver a cada uno" style={{ "--n": 2, "--i": v.view === "min" ? 1 : 0 } as CSSProperties}>
            <span className="vd-shelf__bead" aria-hidden="true" />
            <button type="button" role="radio" ref={(el) => void (segRefs.current[0] = el)} aria-checked={v.view === "quien"} tabIndex={v.view === "quien" ? 0 : -1} className="vd-seg__b" onClick={() => showView("quien")} onKeyDown={segKey}>
              Quién hizo qué
            </button>
            <button type="button" role="radio" ref={(el) => void (segRefs.current[1] = el)} aria-checked={v.view === "min"} tabIndex={v.view === "min" ? 0 : -1} className="vd-seg__b" onClick={() => showView("min")} onKeyDown={segKey}>
              Los minutos
            </button>
          </div>
        )}
      </header>
      <div className="pp-place__body">
        {v.view === "quien" && (
          <div className="ps-grid">
            <div className="ps-pitchcol">
              <div className={`vd-pitch ps-pitch${v.pitchCls ? ` ${v.pitchCls}` : ""}`}>
                <svg className="vd-pitch__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
                  <rect x="4" y="3" width="92" height="134" rx="1" />
                  <line x1="4" y1="70" x2="96" y2="70" />
                  <circle cx="50" cy="70" r="11" />
                  <rect x="26" y="3" width="48" height="17" />
                  <rect x="26" y="120" width="48" height="17" />
                </svg>
                {v.ghost && (
                  <>
                    {v.rings.map((r, i) => (
                      <span key={i} className="ps-ghost" style={{ left: `${r.left}%`, top: `${r.top}%` }} aria-hidden="true" />
                    ))}
                    <p className="ps-ghostnote">Aún sin el siete: el capitán lo saca de la pizarra la víspera.</p>
                  </>
                )}
                {!v.ghost && (
                  <>
                    {v.leaving.map((g) => (
                      <span key={g.key} className="vd-player ps-player ps-leave" style={{ left: `${g.left}%`, top: `${g.top}%`, "--wx": `${g.wx}cqw` } as CSSProperties} aria-hidden="true">
                        <span className="ps-pl">
                          <Tee kit={c.kit} num={g.num} className="ps-tee" />
                          <span className="vd-player__name">{g.name}</span>
                        </span>
                      </span>
                    ))}
                    <ul className="ps-players" aria-label={v.listLabel}>
                      {v.spots.map((p) => (
                        <li key={p.id} className={`vd-player ps-player${p.cls ? ` ${p.cls}` : ""}`} style={{ left: `${p.left}%`, top: `${p.top}%`, "--wx": `${p.wx}cqw` } as CSSProperties}>
                          <button type="button" className="ps-pl" onClick={() => pick(p.id)} aria-pressed={p.on} aria-label={p.label}>
                            <Tee kit={c.kit} num={p.num} className="ps-tee" />
                            <span className="vd-player__name" aria-hidden="true">
                              {p.name}
                            </span>
                          </button>
                          {p.captain && (
                            <span className="ps-cap" aria-hidden="true">
                              C
                            </span>
                          )}
                          {p.me && (
                            <span className="ps-me" aria-hidden="true">
                              Tú
                            </span>
                          )}
                          {p.tags.length > 0 && <Tags tags={p.tags} className="ps-tags" style={{ "--tdy": `${p.tdy}px` } as CSSProperties} />}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <p className="ps-hint">{v.hint}</p>
            </div>

            <div className="ps-panel">
              {card && (
                <section key={card.id} className={`ps-card ${card.cls}`} aria-labelledby="ps-card-t">
                  <div className="ps-card__top">
                    <Tee kit={c.kit} num={card.num} className="ps-card__tee" />
                    <div className="ps-card__who">
                      <p className="ps-card__k">{card.kicker}</p>
                      <h3 id="ps-card-t">
                        {card.name}
                        {card.mine && <span className="ps-me2">Tú</span>}
                        {card.mvp && <span className="vd-tag vd-tag--gold ps-mvptag">MVP</span>}
                      </h3>
                      <p className="ps-card__meta">{card.meta}</p>
                    </div>
                    {card.closable && (
                      <button type="button" className="vd-glass vd-press vd-ibtn ps-card__x" onClick={() => setSel(null)} aria-label={card.closeLabel}>
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                  <p className="ps-card__now">{card.now}</p>
                  {card.counts && (
                    <>
                      <p className="ps-card__k2">{card.seasonLabel}</p>
                      <div className="ps-card__counts">
                        {card.counts.map((cn) => (
                          <div key={cn.l} className="ps-cnt">
                            <span className="ps-cnt__v">{cn.v}</span>
                            <span className="ps-cnt__l">{cn.l}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {!card.counts && card.seasonNote && <p className="ps-card__k2">{card.seasonNote}</p>}
                  {card.href && (
                    <Go className="vd-glass vd-press vd-btn vd-btn--sm ps-card__go" href={card.href}>
                      {card.go}
                      <Icon name="chev-r" />
                    </Go>
                  )}
                </section>
              )}
              {v.mvpWait && (
                <p className="ps-mvp">
                  <Icon name="star" />
                  <span>{v.mvpWait}</span>
                  {v.mvpVote && (
                    <button type="button" className="vd-link" onClick={() => c.go("vestuario")}>
                      Votar al MVP
                    </button>
                  )}
                </p>
              )}
            </div>

            <div className="ps-panel-extra">{v.showChanges && changes(true)}</div>
            <div className="ps-benchcol">
              {v.hasBench && (
                <section className="ps-bench" aria-labelledby="ps-bench-t">
                  <h3 className="ps-k" id="ps-bench-t">
                    {v.benchT}
                  </h3>
                  {v.convo && <p className="ps-convo">{v.convo}</p>}
                  <ul className="ps-rows">
                    {v.bench.map((b) => (
                      <li key={b.id} className={`ps-row${b.cls ? ` ${b.cls}` : ""}`}>
                        <button type="button" className="ps-row__b" onClick={() => pick(b.id)} aria-pressed={b.on}>
                          <Tee kit={c.kit} num={b.num} className="ps-row__tee" />
                          <span className="ps-row__t">
                            <b>{b.name}</b>
                            <span>{b.status}</span>
                          </span>
                        </button>
                        {b.tags.length > 0 && <Tags tags={b.tags} className="ps-rowtags" />}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {v.showChanges && changes(false)}
              {v.showOut && (
                <section className="ps-out" aria-labelledby="ps-out-t">
                  <h3 className="ps-k" id="ps-out-t">
                    No están
                  </h3>
                  <ul className="ps-outl">
                    {v.out.map((o) => (
                      <li key={o.id}>
                        <b>{o.name}</b>
                        <span>{o.why}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {v.showDoor && (
                <p className="ps-door">
                  <Icon name="lock" />
                  <span>Quién falta y por qué, y la pizarra, son del vestuario.</span>
                  <Go className="vd-link" href="/vestuario/puerta">
                    Entrar al vestuario
                  </Go>
                </p>
              )}

              <div className="ps-foot">
                {v.note && <p className="ps-note">{v.note}</p>}
                {v.pizarra && pizarraHref && (
                  <Go className="vd-link" href={pizarraHref}>
                    La pizarra de este partido
                  </Go>
                )}
              </div>
            </div>
          </div>
        )}

        {v.view === "min" && (
          <div className="ps-mins">
            <div className="ps-axis" aria-hidden="true">
              <span>0′</span>
              <span>Descanso</span>
              <span>{c.duration}′</span>
            </div>
            <ol className="ps-st">
              {v.stints.map((s) => (
                <StintRow key={s.id} s={s} sm={false} kit={c.kit} />
              ))}
            </ol>
            {v.unused && <p className="ps-note">{v.unused}</p>}
            <p className="ps-note">{v.minNote}</p>
          </div>
        )}
      </div>
    </section>
  );
}
