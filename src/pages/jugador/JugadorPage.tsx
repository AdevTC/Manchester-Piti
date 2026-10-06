// Ficha de jugador (Celeste · "elegida"): the stadium presents the dorsal, the player's holographic
// cromo (season numbers on the back) and the analyst's report — radar, his jornadas, his goal clock,
// his constellation with the best partner, the vitrina — plus season by season, last games and
// substitutions. From the Design canvas "Estadísticas · elegida" (Ficha de jugador).
import { useMemo, useState } from "react";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { formatDate, playerForSeason, playerName, useClubData, type ClubMatch } from "../../lib/clubData";
import { analysePlayer, chronological, competitionRanks, type PlayerAnalysis } from "../../lib/clubAnalytics";
import { computeStats } from "../../lib/playerStats";
import { collection, goalLinks, per50, radarAverage, radarScores, winRateWith } from "../../lib/statsView";
import { bestPartner, mvpWinners, mvpWins, vitrina } from "../../lib/vestuario";
import { shareClubPage } from "../../lib/share";
import { useMvpResults } from "../vestuario/live";
import { useSeason } from "../../context/SeasonContext";
import { useClock } from "../../hooks/useClock";
import { useTheme } from "../../hooks/useTheme";
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { Constellation, GoalClock, Radar } from "../stats/Charts";
import { Cromo, type CromoFace } from "./Cromo";
import "../../styles/home.css";
import "../../styles/partidos.css";
import "../../styles/stats.css";
import "../../styles/jugador.css";

const route = getRouteApi("/jugadores/$playerId");
const nameOf = (p: PlayerAnalysis) => playerName(p);
const POS: Record<string, string> = { POR: "Portero", DEF: "Defensa", MED: "Centrocampista", DEL: "Delantero" };
const ML = { goals: ["gol", "goles"], assists: ["asistencia", "asistencias"], matchesPlayed: ["partido", "partidos"] } as const;
const letter = (m: ClubMatch) => (m.goalsFor! > m.goalsAgainst! ? "V" : m.goalsFor === m.goalsAgainst ? "E" : "D");

function Shell({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <div className="vx hm st jg" aria-busy={busy}>
      <CelesteBackdrop />
      <CelesteHeader
        active="plantilla"
        sub="Plantilla"
        actions={
          <>
            <ThemeToggle />
            <Link className="hm-cta-top" to="/vestuario">
              <Icon name="padlock" size={16} stroke={2.2} />
              <span className="t">Vestuario</span>
              <span className="hm-sr">Entrar al vestuario</span>
            </Link>
          </>
        }
      />
      {children}
      <CelesteFooter />
      <CelesteDock active="plantilla" />
    </div>
  );
}

export function JugadorPage() {
  const { playerId } = route.useParams();
  const { players, matches, loading, error } = useClubData();
  const { seasons, selectedSeasonId, loadingSeasons } = useSeason();
  const navigate = useNavigate();
  const results = useMvpResults();
  const now = useClock(60_000);
  const { theme } = useTheme();
  const [run, setRun] = useState(0);
  const [vs, setVs] = useState<"avg" | "partner">("avg");
  const [notice, setNotice] = useState("");

  const raw = players.find((x) => x.id === playerId);
  const p = raw ? playerForSeason(raw, selectedSeasonId, seasons) : undefined;
  const games = useMemo(() => chronological(matches.filter((m) => selectedSeasonId === "all" || m.seasonId === selectedSeasonId)), [matches, selectedSeasonId]);
  const squad = useMemo(
    () => players.filter((x) => selectedSeasonId === "all" || x.seasons?.includes(selectedSeasonId) || x.id === playerId).map((x) => analysePlayer(playerForSeason(x, selectedSeasonId, seasons), games)),
    [players, games, selectedSeasonId, seasons, playerId],
  );
  const me = squad.find((x) => x.id === playerId);
  const name = p ? playerName(p) : "";
  const num = p?.number != null ? String(p.number) : "";
  const stills = useShirtStills(p && !p.photoUrl ? [{ kit: "home", theme, name: name.toUpperCase(), num, yaw: 0 }] : [], { offMainThread: true });

  if (loading || error)
    return (
      <Shell busy={loading}>
        <main className="jg-main jg-pad">
          {loading ? (
            <p className="st-state" role="status">
              Preparando la ficha…
            </p>
          ) : (
            <div className="st-state" role="alert">
              <p>No hemos podido cargar los datos del club.</p>
              <button type="button" className="hm-ghostbtn" onClick={() => window.location.reload()}>
                Reintentar
              </button>
            </div>
          )}
        </main>
      </Shell>
    );
  if (!p || !me)
    return (
      <Shell>
        <main className="jg-main jg-pad">
          <div className="st-state">
            <h1 className="st-h2">Jugador no encontrado</h1>
            <Link className="hm-ghostbtn" to="/plantilla">
              Ver plantilla
            </Link>
          </div>
        </main>
      </Shell>
    );

  const periodName = selectedSeasonId === "all" ? "Todo el historial" : (seasons.find((s) => s.id === selectedSeasonId)?.name ?? "Temporada");
  const tracked = me.tracked > 0;
  const rec = (v: number) => (tracked ? v : "—");
  const tiles: [string, string | number][] = [
    ["Partidos", me.matchesPlayed],
    ["Goles", me.goals],
    ["Asistencias", me.assists],
    ["Minutos registrados", tracked ? `${me.minutes}′` : "—"],
    ["Titular", rec(me.starts)],
    ["Suplente inicial", rec(me.bench)],
    ["No convocado", rec(me.notCalled)],
    ["Entradas", rec(me.subIn)],
    ["Salidas", rec(me.subOut)],
    ["Amarillas", me.yellowCards],
    ["Expulsiones", me.redCards],
    ["Penaltis parados", me.penaltySaved],
    ["Goles de penalti", me.goalPenalty],
    ["Goles de falta", me.goalFreekick],
    ["Penaltis cometidos", rec(me.penaltyCommitted)],
    ["Penaltis recibidos", rec(me.penaltyReceived)],
  ];
  const mvps = mvpWins(p.id, games, results, now);
  const goalRank = me.goals > 0 ? competitionRanks(squad, (x) => x.goals).get(p.id) : undefined;
  const assistRank = me.assists > 0 ? competitionRanks(squad, (x) => x.assists).get(p.id) : undefined;
  const badges = [goalRank === 1 && "PICHICHI", assistRank === 1 && "MÁX. ASISTENTE", mvps > 0 && `MVP ×${mvps}`].filter(Boolean) as string[];
  const position = POS[String(p.naturalPosition ?? "").toUpperCase()] ?? (p.naturalPosition || "Jugador");
  const face: CromoFace = {
    name,
    num,
    position: position.toUpperCase(),
    historic: p.active === false,
    photo: p.photoUrl || undefined,
    still: stills({ kit: "home", theme, name: name.toUpperCase(), num, yaw: 0 }),
    badges,
    headline: [
      ["PJ", me.matchesPlayed],
      ["G", me.goals],
      ["A", me.assists],
    ],
    back: tiles.map(([k, v]) => [k, typeof v === "string" ? v.replace("′", " min") : v]),
    period: periodName,
  };

  const p50 = per50(me);
  const win = winRateWith(me);
  const streak = me.contributionStreak.current.count;
  const next = collection([me]).next[0];
  const partner = bestPartner(p.id, games, squad.map((x) => x.id));
  const partnerRow = partner ? squad.find((x) => x.id === partner.playerId) : undefined;
  const medals = vitrina(p.id, games, results, seasons, now);
  const links = goalLinks(games);
  const adn = me.series.slice(-12).map((g) => ({ g, mvp: mvpWinners(g.match, results.get(g.match.id), now).includes(p.id) }));
  const cut = me.series.length - adn.length;
  const appearances = me.series.filter((g) => g.played).slice(-10).reverse();
  const exchanges = me.series.flatMap((g) => (g.match.ledger?.[p.id]?.exchanges ?? []).map((e) => ({ ...e, match: g.match })));
  const allSeasons = seasons.filter((s) => p.seasons?.includes(s.id));
  const seasonRow = (id: string) => {
    const sg = chronological(matches.filter((m) => m.seasonId === id));
    const st = computeStats(p.id, sg);
    const led = sg.filter((m) => m.ledger?.[p.id]);
    return { st, minutes: led.length ? led.reduce((n, m) => n + m.ledger![p.id].minutes, 0) : null, mvps: mvpWins(p.id, sg, results, now) };
  };
  const nameById = new Map(squad.map((x) => [x.id, nameOf(x)]));
  const share = () =>
    shareClubPage("jugador", p.id, `${name} · Manchester Piti`)
      .then(() => setNotice(typeof navigator.share === "function" ? "" : "Enlace copiado."))
      .catch(() => setNotice("No se ha compartido el enlace."));
  const chips: { k: string; v: string | number; sub?: string }[] = [
    { k: "MVP", v: mvps, sub: mvps === 1 ? "partido" : "partidos" },
    { k: "G+A por 50′", v: p50 === null ? "—" : String(p50).replace(".", ",") },
    { k: "Victorias con él", v: win === null ? "—" : `${win}%` },
    { k: "Racha G+A", v: streak, sub: streak ? "seguidos, viva" : "por empezar" },
    ...(next ? [{ k: "Próximo hito", v: next.value, sub: `${ML[next.metric][1]} · faltan ${next.left}` }] : []),
  ];

  return (
    <Shell>
      <section className="jg-hero" aria-labelledby="jg-t">
        <div className="pt-beams" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="st-stars" aria-hidden="true" />
        <div className="jg-hero-in">
          <div className="jg-id">
            <Link className="jg-back" to="/plantilla">
              <Icon name="left" size={16} stroke={2.2} />
              Plantilla
            </Link>
            <span className="hm-kick" style={{ margin: 0 }}>
              {position} · {p.active === false ? "HISTÓRICO" : "PLANTILLA"}
            </span>
            <h1 className="jg-h1" id="jg-t">
              {name}
            </h1>
            {(p.firstName || p.lastName) && <p className="jg-full">{[p.firstName, p.lastName].filter(Boolean).join(" ")}</p>}
            {p.bio && <p className="jg-bio">{p.bio}</p>}
            {p.quote && <blockquote className="jg-quote">«{p.quote}»</blockquote>}
            <p className="st-mono">
              Dorsal {num || "–"} · {p.seasons?.length ?? 0} {(p.seasons?.length ?? 0) === 1 ? "temporada" : "temporadas"} en el club
            </p>
            <div className="jg-acts">
              <button type="button" className="hm-btn jg-share" onClick={share}>
                <Icon name="share" size={16} stroke={2.2} />
                Compartir perfil
              </button>
              <button type="button" className="hm-ghostbtn st-sm" onClick={() => setRun(run + 1)}>
                <Icon name="turn" size={16} />
                Repetir presentación
              </button>
            </div>
            {notice && (
              <p className="st-mono" role="status">
                {notice}
              </p>
            )}
            {(seasons.length > 0 || loadingSeasons) && (
              <label className="st-field jg-season">
                <span className="st-mono">Temporada</span>
                <select aria-label="Seleccionar temporada" value={loadingSeasons ? "all" : selectedSeasonId} disabled={loadingSeasons} onChange={(e) => void navigate({ to: ".", search: (prev) => ({ ...prev, season: e.target.value }) })}>
                  <option value="all">Todo el historial</option>
                  {[...seasons].reverse().map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <Cromo face={face} run={run} />
        </div>
      </section>

      <main className="jg-main">
        <ul className="jg-chips" aria-label="Su temporada en cinco números">
          {chips.map((c, i) => (
            <li key={c.k} style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              <small>
                {c.k} <span className="st-new">nuevo</span>
              </small>
              <b>{c.v}</b>
              {c.sub && <span>{c.sub}</span>}
            </li>
          ))}
        </ul>

        <div className="jg-grid">
          <section className="st-card jg-wide" aria-labelledby="jg-nums">
            <div className="st-hd">
              <span className="hm-kick" style={{ margin: 0 }}>
                {periodName}
              </span>
              <h2 className="st-h2" id="jg-nums">
                Sus números
              </h2>
            </div>
            <dl className="jg-tiles">
              {tiles.map(([k, v], i) => (
                <div key={k} className={i < 4 ? "hl" : undefined}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="st-mono">Minutos, titularidades y cambios solo se cuentan en actas completas.</p>
          </section>

          <section className="st-card" aria-labelledby="jg-radar">
            <div className="st-hd">
              <span className="hm-kick" style={{ margin: 0 }}>
                El perfil <span className="st-new">nuevo</span>
              </span>
              <h2 className="st-h2" id="jg-radar">
                Su radar
              </h2>
            </div>
            {partnerRow && (
              <div className="st-seg sm" role="group" aria-label="Comparar con">
                <button type="button" aria-pressed={vs === "avg"} onClick={() => setVs("avg")}>
                  Media de la plantilla
                </button>
                <button type="button" aria-pressed={vs === "partner"} onClick={() => setVs("partner")}>
                  {nameOf(partnerRow)}
                </button>
              </div>
            )}
            {games.length ? (
              <Radar
                a={radarScores(me, squad, games.length)}
                b={vs === "partner" && partnerRow ? radarScores(partnerRow, squad, games.length) : radarAverage(squad, games.length)}
                aLabel={name}
                bLabel={vs === "partner" && partnerRow ? nameOf(partnerRow) : "Media de la plantilla"}
              />
            ) : (
              <p className="st-empty">El radar se dibuja con el primer partido.</p>
            )}
          </section>

          <section className="st-card" aria-labelledby="jg-adn">
            <div className="st-hd">
              <span className="hm-kick" style={{ margin: 0 }}>
                Jornada a jornada <span className="st-new">nuevo</span>
              </span>
              <h2 className="st-h2" id="jg-adn">
                Su ADN
              </h2>
              <p className="st-mono">Barra, minutos · balón, gol · flecha, asistencia · estrella, MVP</p>
            </div>
            {adn.length ? (
              <ol className="jg-adn" style={{ gridTemplateColumns: `repeat(${Math.max(adn.length, 7)}, minmax(0, 1fr))` }}>
                {adn.map(({ g, mvp }, i) => {
                  const l = letter(g.match);
                  const d = g.match.duration || 50;
                  return (
                    <li key={g.match.id} style={{ animationDelay: `${i * 0.05}s` }}>
                      <Link to="/matches/$matchId" params={{ matchId: g.match.id }} aria-label={`Jornada ${cut + i + 1} contra ${g.match.rival ?? "rival"}: ${g.played ? `${g.minutes ?? "?"} minutos, ${g.goals} goles, ${g.assists} asistencias${mvp ? ", MVP" : ""}` : "no jugó"}`}>
                        <span className="bar">
                          <i style={{ height: g.played ? `${g.minutes === null ? 50 : Math.max(8, (g.minutes / d) * 100)}%` : "0%" }} />
                        </span>
                        <span className="ev" aria-hidden="true">
                          {mvp && <Icon name="star" size={12} />}
                          {Array.from({ length: g.goals }, (_, k) => (
                            <Icon key={"g" + k} name="ball" size={12} />
                          ))}
                          {Array.from({ length: g.assists }, (_, k) => (
                            <Icon key={"a" + k} name="send" size={12} />
                          ))}
                        </span>
                        <span className={`lt ${l}`}>{l}</span>
                        <small>J{cut + i + 1}</small>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="st-empty">Aún sin partidos en este período.</p>
            )}
          </section>

          <section className="st-card" aria-labelledby="jg-clock">
            <div className="st-hd">
              <span className="hm-kick" style={{ margin: 0 }}>
                Cuándo marca <span className="st-new">nuevo</span>
              </span>
              <h2 className="st-h2" id="jg-clock">
                Su reloj de goles
              </h2>
            </div>
            <GoalClock games={games} playerId={p.id} compact />
          </section>

          <section className="st-card" aria-labelledby="jg-sky">
            <div className="st-hd">
              <span className="hm-kick" style={{ margin: 0 }}>
                Con quién se entiende <span className="st-new">nuevo</span>
              </span>
              <h2 className="st-h2" id="jg-sky">
                Su constelación
              </h2>
            </div>
            <Constellation rows={squad} links={links} nameOf={nameOf} focus={links.some((l) => l.from === p.id || l.to === p.id) ? p.id : undefined} />
            {partner && partnerRow && (
              <div className="jg-partner">
                <span className="st-mono">Mejor socio</span>
                <Link to="/jugadores/$playerId" params={{ playerId: partner.playerId }}>
                  {nameOf(partnerRow)}
                </Link>
                <p>
                  {partner.together} {partner.together === 1 ? "partido" : "partidos"} juntos, {partner.wins} {partner.wins === 1 ? "victoria" : "victorias"}
                  {partner.theirGoalsFromYou + partner.yourGoalsFromThem > 0 && ` · pases de gol: ${partner.yourGoalsFromThem} de ${nameOf(partnerRow)} para él, ${partner.theirGoalsFromYou} suyos para ${nameOf(partnerRow)}`}
                </p>
              </div>
            )}
          </section>

          <section className="st-card" aria-labelledby="jg-vit">
            <div className="st-hd">
              <span className="hm-kick" style={{ margin: 0 }}>
                La vitrina <span className="st-new">nuevo</span>
              </span>
              <h2 className="st-h2" id="jg-vit">
                Sus medallas
              </h2>
            </div>
            <ul className="jg-vitrina">
              {medals.map((m, i) => (
                <li key={m.id} className={`${m.earned ? "on" : ""} ${m.tone}`} style={{ animationDelay: `${i * 0.06}s` }}>
                  <Icon name={m.id === "mvp" ? "star" : m.id === "goal" || m.id === "hat" ? "ball" : m.id === "assist" ? "send" : m.id === "debut" ? "shirt" : "trophy"} size={20} />
                  <b>{m.label}</b>
                  <small>{m.detail}</small>
                  {!m.earned && <span className="hm-sr">(por conseguir)</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="st-card jg-two" aria-labelledby="jg-seasons">
            <div className="st-hd">
              <span className="hm-kick" style={{ margin: 0 }}>
                Su historia
              </span>
              <h2 className="st-h2" id="jg-seasons">
                Temporada a temporada
              </h2>
            </div>
            {allSeasons.length ? (
              <div className="st-tablebox">
                <table className="st-table" aria-label="Temporada a temporada">
                  <thead>
                    <tr>
                      <th scope="col">Temporada</th>
                      <th scope="col">Partidos</th>
                      <th scope="col">Goles</th>
                      <th scope="col">Asistencias</th>
                      <th scope="col">Minutos</th>
                      <th scope="col">
                        MVP <span className="st-new">nuevo</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSeasons.map((s) => {
                      const r = seasonRow(s.id);
                      return (
                        <tr key={s.id}>
                          <th scope="row">{s.name}</th>
                          <td>{r.st.matchesPlayed}</td>
                          <td>{r.st.goals}</td>
                          <td>{r.st.assists}</td>
                          <td>{r.minutes ?? "—"}</td>
                          <td>{r.mvps}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="st-empty">Sin temporadas registradas.</p>
            )}
          </section>

          <section className="st-card" aria-labelledby="jg-last">
            <div className="st-hd">
              <span className="hm-kick" style={{ margin: 0 }}>
                {periodName}
              </span>
              <h2 className="st-h2" id="jg-last">
                Sus últimos encuentros
              </h2>
            </div>
            {appearances.length ? (
              <ol className="jg-last">
                {appearances.map((g) => (
                  <li key={g.match.id}>
                    <Link to="/matches/$matchId" params={{ matchId: g.match.id }}>
                      <span className={`lt ${letter(g.match)}`}>{letter(g.match)}</span>
                      <span className="mid">
                        <b>vs {g.match.rival ?? "Rival"}</b>
                        <small>{formatDate(g.match.date)}</small>
                      </span>
                      <span className="sc">
                        {g.match.goalsFor}–{g.match.goalsAgainst}
                      </span>
                      <span className="mn">
                        {g.minutes ?? "—"}′
                        {g.goals > 0 && <i> · {g.goals} G</i>}
                        {g.assists > 0 && <i> · {g.assists} A</i>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="st-empty">Aún no ha jugado en este período.</p>
            )}
          </section>

          {tracked && (
            <section className="st-card" aria-labelledby="jg-subs">
              <div className="st-hd">
                <span className="hm-kick" style={{ margin: 0 }}>
                  Relevos y minutos
                </span>
                <h2 className="st-h2" id="jg-subs">
                  Sus cambios
                </h2>
              </div>
              {exchanges.length ? (
                <ol className="jg-subs">
                  {exchanges.map((e, i) => (
                    <li key={i}>
                      <b>{e.minute}′</b>
                      <span>
                        {e.direction === "in" ? "Entró por" : "Salió por"} {nameById.get(e.with) ?? "un compañero"}
                        <small>
                          vs {e.match.rival ?? "Rival"} · {formatDate(e.match.date)}
                        </small>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="st-empty">Ni un cambio: cuando juega, juega el partido entero.</p>
              )}
            </section>
          )}
        </div>
      </main>
    </Shell>
  );
}

export default JugadorPage;
