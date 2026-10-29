// «El partido» · «Números» (P- boards, place-numeros): before the whistle the rival (the meetings so far, «Su
// siete» from the official pizarra for the vestuario, locked for a fan) and what is at stake (G · E · P move the
// table); while it is played the match in numbers up to the moviola's minute and «Si acaba así»; once played the
// whole match, «De un vistazo» and «Quién sumó» from the shared catalogue, the table after the jornada and the record
// against them; aplazado or pendiente, a still. With no table published, the league's story in its place. The
// words and the table are pure in numerosModel.ts; the figures in matchNumbers.ts.
import { useMemo, useState, type CSSProperties } from "react";
import type { AnalysisFilters } from "../../../../functions/src/narrated/types";
import { StatsChartsPanel } from "../../../components/celeste/StatsChartsPanel";
import { RivalMark } from "../../../components/vidrio/RivalMark";
import { dateMillis, formatDate, isCompleted, type ClubMatch } from "../../../lib/clubData";
import { useStandings } from "../../../lib/useStandings";
import { rivalDossier, rivalKey } from "../../../lib/derived/rival";
import { jornadaOf } from "../../../lib/derived/jornada";
import { seasonStrip } from "../../../lib/derived/vidrio/strip";
import { scoreOf } from "../../../lib/partidos";
import { systemMark } from "../../../lib/derived/system";
import { toBePlayed } from "../../../lib/derived/kickoff";
import { tonightWord } from "../../../lib/derived/madrid";
import { venueName } from "../../../lib/derived/venue";
import { useBoardView, useMatchBoard } from "../../pizarra/useMatchBoard";
import { rivalName } from "../../pizarra/v2/rival";
import type { PageCtx } from "./ctx";
import { Go, Icon, Tee } from "./bits";
import { matchNumbers } from "./matchNumbers";
import {
  chipsOf,
  fixturesOf,
  formLabel,
  formOf,
  headOf,
  noTableOf,
  ORD,
  PICK_WORD,
  recordAfter,
  recordText,
  rivalFacts,
  rivalLede,
  saveNoteOf,
  signed,
  tableView,
  type Letter,
  type Moment,
  type Record3,
} from "./numerosModel";

export function ScreenNumeros({ c }: { c: PageCtx }) {
  const { match, rival, fase } = c;
  const seasonId = match.seasonId ?? "";
  const [pickState, setPick] = useState<Letter | null>(null);
  const [all, setAll] = useState(false);
  const pick = c.pre ? pickState : null;
  const mo: Moment = { pre: c.pre, live: c.live, played: c.played, done: c.done, final: fase === "final", off: c.off, dragged: c.dragged, minute: c.minute, edge: c.edge, duration: c.duration };

  // ---- the season around it (this match as the page sees it: the maqueta's moment in DEV)
  const season = useMemo(() => c.matches.map((x) => (x.id === match.id ? match : x)), [c.matches, match]);
  const segments = useMemo(() => (seasonId ? seasonStrip(season, seasonId, c.now).segments : []), [season, seasonId, c.now]);
  const counted = segments.filter((s) => s.state !== "suspendido");
  const at = counted.findIndex((s) => s.id === match.id);
  const before = at > 0 ? counted.slice(0, at).filter((s) => s.state === "jugado" && !s.provisional) : [];
  const soFar = before.reduce((a, s) => {
    const sc = scoreOf(s.match);
    return { pts: a.pts + (sc.gf > sc.ga ? 3 : sc.gf === sc.ga ? 1 : 0), dg: a.dg + sc.gf - sc.ga };
  }, { pts: 0, dg: 0 });
  const teams = new Set(counted.map((s) => rivalKey(s.rival))).size + 1;
  const left = c.next.length;
  const first = before.length === 0;

  // ---- the meetings with the rival (every season): before this one, and with it once it is in the acta
  const dosBefore = useMemo(() => rivalDossier(season, rival, { exclude: match.id }), [season, rival, match.id]);
  const dosAll = useMemo(() => rivalDossier(season, rival), [season, rival]);
  const recBefore: Record3 = dosBefore.record;
  const recAll: Record3 = isCompleted(match) ? dosAll.record : recBefore;

  // ---- the table
  const { standings } = useStandings(seasonId || undefined);
  const rows = standings && standings.rows.some((r) => r.pj > 0) ? standings.rows : null;
  const hasTable = !!rows;
  const already = !!standings && standings.jornada != null && c.jornada != null && standings.jornada >= c.jornada;
  const table = rows ? tableView(mo, rows, { rival, score: c.score, pick, all, jornada: c.jornada, tableJornada: standings?.jornada ?? null, already, allZero: rows.every((r) => r.pj === 0), kickoff: dateMillis(match.date) }) : null;
  const me = table?.me ?? null;
  const chips = chipsOf(rows, rival, first, left);
  const winLine = rows ? (chips[0].line.charAt(0).toLowerCase() + chips[0].line.slice(1)) : "";
  const place = me ? `${ORD(me.pos)} con ${me.pts} ${me.pts === 1 ? "punto" : "puntos"}` : null;
  const head = headOf(mo, { hasTable, place, pos: me?.pos ?? null, winLine, rec: recBefore, result: c.result, narrated: c.nums.narrated, descanso: fase === "descanso" });
  const noTable = rows ? null : noTableOf(mo, { score: c.score, left, total: counted.length, playedBefore: before.length, teams, season: soFar, jornada: c.jornada });
  const tTitle = table?.title ?? (pick ? PICK_WORD[pick] : "La clasificación");
  const tSub = table?.sub ?? (pick ? `Con un ${pick === "G" ? "1–0" : pick === "E" ? "1–1" : "0–1"}, por ejemplo; los demás, sin jugar` : c.pre && first ? `Todos a cero: la liga empieza ${tonightWord(dateMillis(match.date))}` : "");
  const counts = me
    ? [
        { v: ORD(me.pos), t: mo.final ? "si lo confirma" : c.played && !c.done && !already ? "si acaba así" : "en la tabla" },
        { v: String(me.pts), t: me.pts === 1 ? "punto" : "puntos" },
        { v: signed(me.dg), t: "de diferencia" },
      ]
    : [];

  // ---- the rival's seven (the official board; team-only reads, before the whistle)
  const upcoming = toBePlayed(match, c.now);
  const boardId = useMatchBoard(match.seasonId, match.id, upcoming, c.viewer.member && c.pre);
  const plan = useBoardView(c.viewer.member && c.pre ? boardId : null)?.rival ?? null;
  const notes = plan ? plan.players.map((p, i) => ({ who: rivalName(plan, i), note: p.note ?? "" })).filter((n) => n.note) : [];
  // (how they come: the table as published, never a pick's projection)
  const theirIdx = rows ? rows.findIndex((r) => !r.isUs && rivalKey(r.team) === rivalKey(rival)) : -1;
  const theirRow = rows && theirIdx >= 0 ? { pos: theirIdx + 1, pts: rows[theirIdx].pts, pj: rows[theirIdx].pj } : null;
  const lastMeet = dosBefore.last[0];
  const lede = rivalLede(rival, recBefore, lastMeet ? { gf: lastMeet.goalsFor ?? 0, ga: lastMeet.goalsAgainst ?? 0, when: formatDate(lastMeet.date) } : null);
  const facts = rivalFacts({ home: match.home !== false, venue: venueName(match.venue ?? ""), jornada: c.jornada, theirRow });

  // ---- the numbers up to the moviola's minute
  const saveNote = c.played ? saveNoteOf(c.plays, null, c.minute, c.duration, c.nameOf) : "";
  const numsSub = c.minute >= c.duration ? `Los ${c.duration}′` : `Hasta el ${c.minute}′`;
  const chartMatches = useMemo(() => [match], [match]);
  const chartPeople = useMemo(() => [...c.people.values()].map(p => ({ id: p.id, name: p.name, number: p.num || undefined })), [c.people]);
  const chartFilters = useMemo<AnalysisFilters>(() => ({
    matchIds: [match.id],
    // A displayed minute includes its whole one-based football minute. Without a
    // cut at the final whistle, exact boundary actions stay in the completed acta.
    ...(c.dragged || !c.done && c.live ? { toSecond: Math.max(0, c.minute) * 60 } : {}),
  }), [match.id, c.dragged, c.done, c.live, c.minute]);
  const figures = useMemo(() => c.played ? matchNumbers(match, chartPeople, chartFilters, c.score) : null, [c.played, match, chartPeople, chartFilters, c.score]);
  const nums = figures?.rows ?? [];
  const vistazo = c.done ? figures?.glance ?? [] : [];
  const leaders = c.done ? figures?.leaders ?? [] : [];

  // ---- la forma, the season left, the record
  const form = c.played || c.off ? formOf(segments, match.id, mo, c.score, c.result) : null;
  const jOf = (id: string) => jornadaOf(c.matches, id);
  const fix = fixturesOf(c.next, jOf, (m: ClubMatch) => dateMillis(m.date));
  const rec = c.done
    ? recordAfter({
        rec: recAll,
        scorers: dosAll.scorers.map((s) => ({ name: c.nameOf(s.id), goals: s.goals })),
        biggest: dosAll.biggestWin ? { gf: dosAll.biggestWin.goalsFor ?? 0, ga: dosAll.biggestWin.goalsAgainst ?? 0, here: dosAll.biggestWin.id === match.id, when: formatDate(dosAll.biggestWin.date) } : null,
      })
    : null;
  const recWords = recordText(recAll);

  const cls = ["pp-place", "pp-place--numeros", `is-${c.pre ? "pre" : c.played && !c.done ? "live" : c.done ? "done" : "off"}`, c.dragged ? "is-dragged" : ""].filter(Boolean).join(" ");
  const choose = (l: Letter) => {
    const off = pick === l;
    setPick(off ? null : l);
    c.say(off ? "La tabla, como está." : `La tabla, ${PICK_WORD[l].toLowerCase()}.`);
  };

  return (
    <section className={cls} aria-labelledby="ppn-h">
      <header className="pp-place__head">
        <div>
          <h2 id="ppn-h">{head.title}</h2>
          <p>{head.sub}</p>
        </div>
        {c.played && <a className="vd-glass vd-press vd-btn vd-btn--sm" href="#ppn-charts"><Icon name="chart" />Red de pases y gráficas</a>}
      </header>
      <div className="pp-place__body">
        <div className="ppn">
          <div className="ppn-col ppn-col--a">
            {c.off && (
              <>
                <div className="ppn-still">
                  <Icon name={c.off === "aplazado" ? "cal" : "mesa"} />
                  <p>
                    <b>{c.off === "aplazado" ? "La tabla no cuenta este partido hasta que se juegue" : "Sin acta no hay números"}</b>
                    <span>{c.off === "aplazado" ? "Cuando la liga ponga la fecha nueva, aquí saldrán el rival, lo que se juega y el partido en números." : "Con el acta saldrán aquí el partido en números, De un vistazo y la tabla con el Piti dentro."}</span>
                  </p>
                </div>
                <p className="ppn-offriv">
                  <span className="ppn-crest" aria-hidden="true">
                    <RivalMark logo={c.rivalLogo}>{c.rivalCode}</RivalMark>
                  </span>
                  <span>
                    {c.off === "aplazado"
                      ? `${rival}, sin jugar todavía: ${recBefore.played ? "el cara a cara" : "el primer cara a cara"} espera fecha.`
                      : recBefore.played
                        ? `Contra ${rival}: ${recordText(recBefore).short}. Este partido se suma con el acta.`
                        : `Primera vez contra ${rival}: el historial se abre con el acta.`}
                  </span>
                </p>
              </>
            )}

            {c.pre && (
              <section className="ppn-sec ppn-rival" aria-labelledby="ppn-rival-h">
                <div className="ppn-rival__id">
                  <span className="ppn-crest ppn-crest--big" aria-hidden="true">
                    <RivalMark logo={c.rivalLogo}>{c.rivalCode}</RivalMark>
                  </span>
                  <div>
                    <span className="ppn-kick">El rival</span>
                    <h3 id="ppn-rival-h">{rival}</h3>
                  </div>
                </div>
                <p className="ppn-lede">
                  <b>{lede.b}</b> {lede.rest}
                </p>
                <ul className="ppn-facts">
                  {facts.map((f) => (
                    <li key={f.text}>
                      <Icon name={f.icon} />
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
                {c.viewer.member ? (
                  <div className="ppn-plan">
                    <p className="ppn-plan__k">
                      <Icon name="lock" />
                      Solo el vestuario · de la pizarra oficial
                    </p>
                    {plan ? (
                      <>
                        <h4>{systemMark(plan.formation) ? `Su siete, en ${systemMark(plan.formation)}` : "Su siete"}</h4>
                        {notes.length ? (
                          <ol className="ppn-plan__list">
                            {notes.map((n) => (
                              <li key={n.who}>
                                <b>{n.who}</b>
                                <span>{n.note}</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="ppn-lede">La pizarra tiene su siete, todavía sin notas sobre ninguno.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <h4>Su siete</h4>
                        <p className="ppn-lede">La pizarra oficial de este partido aún no tiene su siete: cuando el capitán lo dibuje, sus notas saldrán aquí.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="ppn-locked">
                    <Icon name="lock" />
                    <p>Lo que el capitán apunta de su siete se queda en el vestuario.</p>
                    <Go className="vd-link" href="/vestuario/puerta">
                      Entrar al vestuario
                    </Go>
                  </div>
                )}
              </section>
            )}

            {c.played && (
              <section className="ppn-sec ppn-nums" aria-labelledby="ppn-nums-h">
                <h3 className="vd-vh" id="ppn-nums-h">
                  Las cifras del partido
                </h3>
                <p className="ppn-legend" aria-hidden="true">
                  <span className="ppn-legend__us">Piti</span>
                  <span className="ppn-legend__mid">{numsSub}</span>
                  <span className="ppn-legend__them">{rival}</span>
                </p>
                <ul className="ppn-bars">
                  {nums.map((r, i) => (
                    <li
                      key={r.k}
                      className={["ppn-bar", r.k === "gol" ? "is-gol" : "", r.us != null && r.them != null ? r.us > r.them ? "is-us" : r.them > r.us ? "is-them" : "" : ""].filter(Boolean).join(" ")}
                      role="img"
                      aria-label={`${r.label}: Piti ${r.us == null ? "sin dato suficiente" : r.usText}, ${rival} ${r.them == null ? "sin dato suficiente" : r.themText}`}
                      style={{ "--d": i } as CSSProperties}
                    >
                      <b className="ppn-bar__n" aria-hidden="true">
                        {r.usText}
                      </b>
                      <div className="ppn-bar__c" aria-hidden="true">
                        <span className="ppn-bar__l">
                          <Icon name={r.icon as Parameters<typeof Icon>[0]["name"]} />
                          {r.label}
                        </span>
                        <span className="ppn-bar__m">
                          <span className="ppn-bar__g ppn-bar__g--us">
                            <i style={{ width: `${r.usW}%` }} />
                          </span>
                          <span className="ppn-bar__g ppn-bar__g--them">
                            <i style={{ width: `${r.themW}%` }} />
                          </span>
                        </span>
                      </div>
                      <b className="ppn-bar__n ppn-bar__n--them" aria-hidden="true">
                        {r.themText}
                      </b>
                    </li>
                  ))}
                </ul>
                <div className="ppn-nums__foot">
                  <p className="ppn-note">{figures?.partial ? "Cobertura parcial: solo cuentan las acciones confirmadas. — indica que faltan datos para esa cifra." : "Las cifras usan las mismas reglas y jugadas que Estadísticas y las gráficas."}</p>
                  {saveNote && (
                    <p className="ppn-save">
                      <Icon name="glove" />
                      {saveNote}
                    </p>
                  )}
                </div>
              </section>
            )}

            {c.done && vistazo.length > 0 && (
              <section className="ppn-sec ppn-vistazo" aria-labelledby="ppn-vis-h">
                <div className="ppn-sec__head">
                  <h3 id="ppn-vis-h">De un vistazo</h3>
                  <span className="ppn-tagacta">
                    <Icon name="mesa" />
                    {c.nums.narrated ? "Del relato narrado" : "Del acta"}
                  </span>
                </div>
                <p className="ppn-note">{c.dragged ? `El Piti hasta el ${c.minute}′ de la moviola.` : "El Piti, todo el partido."} Mismas reglas que el catálogo: las acciones sin resultado no entran en el denominador del acierto.</p>
                <ul className="ppn-vis">
                  {vistazo.map((v) => (
                    <li key={v.t} className="vd-count ppn-vis__i">
                      <b className="ppn-num">
                        {v.display}{v.n == null ? "" : v.unit}
                      </b>
                      <span className="ppn-numw">{v.t}</span>
                      <small>{v.d}</small>
                    </li>
                  ))}
                </ul>
                <Go className="vd-glass vd-press vd-btn vd-btn--sm ppn-open" href={`/estadisticas/juego?temporada=todas&partidos=${encodeURIComponent(match.id)}`}>
                  <Icon name="chart" />
                  Abrir el análisis en Estadísticas
                </Go>
              </section>
            )}
            {c.done && leaders.length > 0 && (
              <section className="ppn-sec ppn-lead" aria-labelledby="ppn-lead-h">
                <div className="ppn-sec__head">
                  <h3 id="ppn-lead-h">Quién sumó</h3>
                  <span className="ppn-sec__sub">{c.dragged ? `Hasta el ${c.minute}′` : "Del acta y sus jugadas"}</span>
                </div>
                <ul className="ppn-lead__l">
                  {leaders.map((l) => (
                    <li key={`${l.what}:${l.id}`}>
                      <Tee kit={c.kit} num={c.numOf(l.id)} className="ppn-lead__tee" />
                      <span className="ppn-lead__w">
                        <small>{l.what}</small>
                        <b>{c.nameOf(l.id)}</b>
                        <span>
                          {l.display} {l.t}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {mo.final && (
              <p className="ppn-wait">
                <Icon name="chart" />
                <span>
                  <b>De un vistazo llega con el acta.</b> Remates, pases y recuperaciones, de las jugadas que narre la mesa.
                </span>
              </p>
            )}
          </div>

          <div className="ppn-col ppn-col--b">
            {c.pre && (
              <section className="ppn-sec ppn-stakes" aria-labelledby="ppn-stakes-h">
                <div className="ppn-sec__head">
                  <h3 id="ppn-stakes-h">Lo que se juega</h3>
                </div>
                <p className="ppn-note">Toca un resultado y la tabla se pone así.</p>
                <ul className="ppn-chips">
                  {chips.map((ch) => (
                    <li key={ch.l}>
                      <button type="button" className={`vd-glass vd-press ppn-chip ppn-chip--${ch.l.toLowerCase()}`} aria-pressed={pick === ch.l} aria-label={ch.aria} onClick={() => choose(ch.l)}>
                        <span className={`vd-form__l${ch.l === "G" ? " vd-form__l--g" : ch.l === "P" ? " vd-form__l--p" : ""} ppn-chip__l`} aria-hidden="true">
                          {ch.l}
                        </span>
                        <span className="ppn-chip__w" aria-hidden="true">
                          <b>{ch.word}</b>
                          <span>{ch.line}</span>
                        </span>
                        <span className="ppn-chip__p" aria-hidden="true">
                          {ch.pos}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="ppn-sec ppn-tabla" aria-labelledby="ppn-tabla-h">
              <div className="ppn-sec__head">
                <h3 id="ppn-tabla-h">{tTitle}</h3>
                <span className="ppn-sec__sub">{tSub}</span>
              </div>
              {noTable && (
                <div className="ppn-notable">
                  <p className="ppn-notable__big">{noTable.big}</p>
                  <p className="ppn-lede">{noTable.line}</p>
                  <ul className="ppn-points">
                    {noTable.points.map((k) => (
                      <li key={k.t} className="vd-count">
                        <b className="ppn-num">{k.v}</b>
                        <span className="ppn-numw">{k.t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {table && (
                <>
                  {(c.played || c.done) && counts.length > 0 && (
                    <div className="ppn-counts">
                      {counts.map((k) => (
                        <p key={k.t} className="vd-count">
                          <b className="ppn-num">{k.v}</b>
                          <span className="ppn-numw">{k.t}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <table className="vd-table ppn-table">
                    <caption className="vd-vh">
                      {tTitle}. {tSub}
                    </caption>
                    <thead>
                      <tr>
                        <th className="t" colSpan={2}>
                          Equipo
                        </th>
                        <th>
                          <abbr title="Partidos jugados">PJ</abbr>
                        </th>
                        <th className="h-sm">
                          <abbr title="Ganados">G</abbr>
                        </th>
                        <th className="h-sm">
                          <abbr title="Empatados">E</abbr>
                        </th>
                        <th className="h-sm">
                          <abbr title="Perdidos">P</abbr>
                        </th>
                        <th>
                          <abbr title="Diferencia de goles">DG</abbr>
                        </th>
                        <th>
                          <abbr title="Puntos">Pts</abbr>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.items.map((r) =>
                        r.kind === "gap" ? (
                          <tr key={r.key} className="vd-gap">
                            <td colSpan={8}>
                              <span aria-hidden="true">…</span>
                              <span className="vd-vh">{r.text}</span>
                            </td>
                          </tr>
                        ) : (
                          <tr key={r.key} className={[r.us ? "us" : "", r.prov ? "prov" : ""].filter(Boolean).join(" ") || undefined} aria-current={r.us ? "true" : undefined}>
                            <td className="p">{r.pos}</td>
                            <td className="t">
                              <span className="ppn-team">{r.team}</span>
                              <span className="ppn-marks">
                                {r.us && table.provWord && <span className="vd-provtag">{table.provWord}</span>}
                                {r.mark && (
                                  <span className="vd-move">
                                    <Icon name="arrow" className={`pp-i ${r.up ? "ppn-up-i" : "ppn-down-i"}`} />
                                    {r.mark}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td>{r.pj}</td>
                            <td className="h-sm">{r.g}</td>
                            <td className="h-sm">{r.e}</td>
                            <td className="h-sm">{r.p}</td>
                            <td>{r.dg}</td>
                            <td className="pts">{r.pts}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                  {(table.hidden > 0 || all) && (
                    <div className="vd-more ppn-more">
                      <span>
                        Estás viendo los de tu zona: <b>{table.hidden} equipos más</b>
                      </span>
                      <button type="button" className="vd-more__btn" aria-expanded={all} onClick={() => setAll(!all)}>
                        {all ? "Ver solo mi zona" : `Ver la tabla entera (${table.rows.length})`}
                        <Icon name="expand" />
                      </button>
                    </div>
                  )}
                </>
              )}
              {pick && (
                <button
                  type="button"
                  className="vd-link ppn-reset"
                  onClick={() => {
                    setPick(null);
                    c.say("La tabla, como está.");
                  }}
                >
                  Volver a la tabla de ahora
                </button>
              )}
              {form && form.items.length > 0 && (
                <div className="ppn-form">
                  <p className="ppn-note">{form.from && form.to ? `La forma, de la ${form.from} a la ${form.to}` : "La forma"}</p>
                  <ol className="vd-form" aria-label={formLabel(mo, c.jornada, c.result, left)}>
                    {form.items.map((l, i) => (
                      <li key={i} className={`vd-form__l vd-form__l--${l.tone}`} aria-label={l.aria}>
                        <span aria-hidden="true">{l.t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>

            {fix.list.length > 0 && (
              <section className="ppn-sec ppn-fix" aria-labelledby="ppn-fix-h">
                <div className="ppn-sec__head">
                  <h3 id="ppn-fix-h">El calendario que queda</h3>
                  <span className="ppn-sec__sub">{fix.sub}</span>
                </div>
                <ol className="ppn-fix__l">
                  {fix.list.map((x) => (
                    <li key={x.id}>
                      <span className="vd-form__l vd-form__l--empty ppn-fix__j" aria-hidden="true">
                        {x.j}
                      </span>
                      <span className="ppn-fix__t">
                        <b>{x.rival}</b>
                        <span>{x.where}</span>
                      </span>
                      <span className="ppn-fix__w">{x.when}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {rec && (
              <section className="ppn-sec ppn-record" aria-labelledby="ppn-rec-h">
                <div className="ppn-rival__id">
                  <span className="ppn-crest" aria-hidden="true">
                    <RivalMark logo={c.rivalLogo}>{c.rivalCode}</RivalMark>
                  </span>
                  <div>
                    <span className="ppn-kick">El rival</span>
                    <h3 id="ppn-rec-h">
                      Contra {rival}: <span aria-hidden="true">{recWords.short}</span>
                      <span className="vd-vh">{recWords.long}</span>
                    </h3>
                  </div>
                </div>
                <p className="ppn-lede">{rec.lede}</p>
                <div className="ppn-goalbar">
                  <p>
                    <span>
                      <b>{recAll.gf}</b> a favor
                    </span>
                    <span>
                      <b>{recAll.ga}</b> en contra
                    </span>
                  </p>
                  <span className="ppn-goalbar__bar" aria-hidden="true">
                    <i className="ppn-goalbar__us" style={{ flex: recAll.gf }} />
                    <i className="ppn-goalbar__them" style={{ flex: recAll.ga }} />
                  </span>
                </div>
                <dl className="ppn-dl">
                  <div>
                    <dt>Les marcan</dt>
                    <dd>{rec.scorers}</dd>
                  </div>
                  <div>
                    <dt>{rec.bestK}</dt>
                    <dd>{rec.best}</dd>
                  </div>
                </dl>
              </section>
            )}
          </div>
        </div>
        {c.played && <div id="ppn-charts" className="ppn-charts">
          <p className="ppn-charts__scope">{chartFilters.toSecond != null ? `Hasta el ${c.minute}′ de la moviola. Las acciones posteriores no entran en estas gráficas.` : "Este partido completo · Manchester Piti"}</p>
          <StatsChartsPanel matches={chartMatches} people={chartPeople} filters={chartFilters}/>
        </div>}
      </div>
    </section>
  );
}

