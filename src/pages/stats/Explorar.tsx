// "Explorar" of the Celeste Estadísticas page: individual records (every tie shown, full ranking on
// demand), streaks and the season collection of milestones, team records and streaks, and the
// cumulative evolution with a scrubber plus ranking bars.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatDate, type ClubMatch } from "../../lib/clubData";
import { competitionRanks, individualRecords, teamAnalysis, teamRecords, type PlayerAnalysis, type RecordEntry, type Streak } from "../../lib/clubAnalytics";
import { collection } from "../../lib/statsView";
import { Icon, type IconName } from "../../components/celeste/icons";
import { Bars } from "./Charts";

export type ExploreSection = "individual" | "streaks" | "team" | "evolution";
type NameOf = (p: PlayerAnalysis) => string;
const SECTIONS: [ExploreSection, string, IconName][] = [
  ["individual", "Récords individuales", "trophy"],
  ["streaks", "Rachas e hitos", "flame"],
  ["team", "Récords del equipo", "shield"],
  ["evolution", "Evolución y rankings", "stats"],
];

function MatchLink({ match }: { match: ClubMatch }) {
  return (
    <Link to="/matches/$matchId" params={{ matchId: match.id }} className="st-mlink">
      {match.goalsFor}–{match.goalsAgainst} vs {match.rival ?? "Rival"}
      <small>{formatDate(match.date)}</small>
    </Link>
  );
}

function RecordCard({ title, unit, entries, names, lower = false, i = 0 }: { title: string; unit: string; entries: RecordEntry[]; names: Map<string, string>; lower?: boolean; i?: number }) {
  const best = entries[0]?.value;
  const holders = entries.filter((e) => e.value === best);
  const ranks = competitionRanks(entries, (e) => (lower ? -e.value : e.value));
  return (
    <article className="st-rec" style={{ animationDelay: `${i * 0.07}s` }}>
      <span className="hm-kick" style={{ margin: 0 }}>
        {title}
      </span>
      {best !== undefined ? (
        <>
          <div className="st-rec-v">
            {best}
            <small>{unit}</small>
          </div>
          <ul className="st-rec-h">
            {holders.map((e) => (
              <li key={e.id}>
                {e.playerId && (
                  <Link to="/jugadores/$playerId" params={{ playerId: e.playerId }}>
                    <strong>{names.get(e.playerId) ?? "Jugador"}</strong>
                  </Link>
                )}
                <MatchLink match={e.match} />
              </li>
            ))}
          </ul>
          {holders.length > 1 && <span className="st-mono">Récord compartido</span>}
          <details className="st-more">
            <summary>
              Clasificación completa <span>{entries.length}</span>
            </summary>
            <ol>
              {entries.map((e) => (
                <li key={e.id}>
                  <b>{ranks.get(e.id)}</b>
                  <span>
                    {e.playerId && <strong>{names.get(e.playerId) ?? "Jugador"}</strong>}
                    <MatchLink match={e.match} />
                  </span>
                  <b>{e.value}</b>
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : (
        <p className="st-empty">Sin registros en este período.</p>
      )}
    </article>
  );
}

function StreakCard({ title, data, i = 0 }: { title: string; data: { best: Streak; current: Streak; runs: Streak[] }; i?: number }) {
  return (
    <article className="st-rec" style={{ animationDelay: `${i * 0.07}s` }}>
      <span className="hm-kick" style={{ margin: 0 }}>
        {title}
      </span>
      <div className="st-rec-v">
        {data.best.count}
        <small>{data.best.count === 1 ? "partido" : "partidos seguidos"}</small>
      </div>
      <p className={`st-cur${data.current.count ? " live" : ""}`}>
        {data.current.count > 0 && <Icon name="flame" size={15} />}
        Racha actual: <b>{data.current.count}</b>
      </p>
      {data.best.from && data.best.to && (
        <p className="st-mono">
          {formatDate(data.best.from.date)} — {formatDate(data.best.to.date)}
        </p>
      )}
      {data.runs.length > 0 && (
        <details className="st-more">
          <summary>
            Ver todas las rachas <span>{data.runs.length}</span>
          </summary>
          <ol>
            {data.runs.map((s, k) => (
              <li key={s.from!.id}>
                <b>{k + 1}</b>
                <span>
                  <MatchLink match={s.from!} />
                  {s.to!.id !== s.from!.id && <MatchLink match={s.to!} />}
                </span>
                <b>{s.count}</b>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

const STREAKS = {
  goalStreak: "Marcando",
  assistStreak: "Asistiendo",
  contributionStreak: "Marcando o asistiendo",
  appearanceStreak: "Participando",
  cleanStreak: "Jugando sin tarjetas",
} as const;
type StreakKey = keyof typeof STREAKS;
const MS_LABEL = { goals: ["gol", "goles"], assists: ["asistencia", "asistencias"], matchesPlayed: ["partido", "partidos"] } as const;

export function Explorar({ rows, games, section, onSection, nameOf }: { rows: PlayerAnalysis[]; games: ClubMatch[]; section: ExploreSection; onSection: (s: ExploreSection) => void; nameOf: NameOf }) {
  const names = useMemo(() => new Map(rows.map((p) => [p.id, nameOf(p)])), [rows, nameOf]);
  return (
    <div className="st-pane-in">
      <nav className="st-subnav" aria-label="Secciones del explorador">
        {SECTIONS.map(([k, l, icon]) => (
          <button key={k} type="button" aria-pressed={section === k} onClick={() => onSection(k)}>
            <Icon name={icon} size={16} />
            {l}
          </button>
        ))}
      </nav>
      <div key={section} className="st-sub">
        {section === "individual" && <Individual rows={rows} names={names} nameOf={nameOf} />}
        {section === "streaks" && <Streaks rows={rows} names={names} nameOf={nameOf} />}
        {section === "team" && <Team games={games} />}
        {section === "evolution" && <Evolution rows={rows} games={games} nameOf={nameOf} />}
      </div>
    </div>
  );
}

function Individual({ rows, names, nameOf }: { rows: PlayerAnalysis[]; names: Map<string, string>; nameOf: NameOf }) {
  const fastest = rows
    .flatMap((p) =>
      p.series.flatMap((g) =>
        (g.match.events ?? [])
          .filter((e) => e.playerId === p.id && ["goal", "goal_penalty", "goal_freekick"].includes(e.type) && typeof e.minute === "number")
          .map((e) => ({ id: p.id + ":" + g.match.id + ":" + e.id, playerId: p.id, match: g.match, value: e.minute! })),
      ),
    )
    .sort((a, b) => a.value - b.value);
  return (
    <>
      <div className="st-hd">
        <span className="hm-kick" style={{ margin: 0 }}>
          Mejores actuaciones
        </span>
        <h2 className="st-h2">Récords individuales</h2>
        <p className="st-mono">Si dos jugadores comparten la mejor marca, salen los dos.</p>
      </div>
      <div className="st-recs">
        <RecordCard i={0} title="Más goles en un partido" unit="goles" entries={individualRecords(rows, "goals")} names={names} />
        <RecordCard i={1} title="Más asistencias en un partido" unit="asist." entries={individualRecords(rows, "assists")} names={names} />
        <RecordCard i={2} title="Mayor participación en goles" unit="G+A" entries={individualRecords(rows, "ga")} names={names} />
        <RecordCard i={3} title="Gol más temprano" unit="minuto" entries={fastest} names={names} lower />
      </div>
      <div className="st-three">
        <section className="st-card">
          <h3 className="st-h3">Dobletes o más</h3>
          <Bars rows={rows} value={(p) => p.braces} unit="partidos" nameOf={nameOf} />
        </section>
        <section className="st-card">
          <h3 className="st-h3">Hat-tricks</h3>
          <Bars rows={rows} value={(p) => p.hatTricks} unit="partidos" nameOf={nameOf} empty="Nadie ha marcado tres en un partido todavía." />
        </section>
        <section className="st-card">
          <h3 className="st-h3">Asistencias múltiples</h3>
          <Bars rows={rows} value={(p) => p.multiAssists} unit="partidos" nameOf={nameOf} />
        </section>
      </div>
    </>
  );
}

function Streaks({ rows, names, nameOf }: { rows: PlayerAnalysis[]; names: Map<string, string>; nameOf: NameOf }) {
  const [kind, setKind] = useState<StreakKey>("goalStreak");
  const [filter, setFilter] = useState<"all" | "goals" | "assists" | "matchesPlayed">("all");
  const [visible, setVisible] = useState(12);
  const ordered = rows.filter((p) => p[kind].best.count > 0).sort((a, b) => b[kind].best.count - a[kind].best.count || nameOf(a).localeCompare(nameOf(b)));
  const ranks = competitionRanks(ordered, (p) => p[kind].best.count);
  const longest = ordered[0]?.[kind].best.count || 1;
  const col = useMemo(() => collection(rows), [rows]);
  const got = col.got.filter((s) => filter === "all" || s.metric === filter);
  const next = col.next.filter((s) => filter === "all" || s.metric === filter);
  const nextGoals = [...rows].filter((p) => p.matchesPlayed > 0).sort((a, b) => b.goals - a.goals || nameOf(a).localeCompare(nameOf(b)));
  const stepAfter = (v: number) => [1, 5, 10, 25, 50, 100, 150, 200, 300, 500, 1000].find((s) => s > v) ?? v + 100;
  return (
    <>
      <section className="st-card">
        <div className="st-hd">
          <span className="hm-kick" style={{ margin: 0 }}>
            Regularidad
          </span>
          <h2 className="st-h2">Ranking de rachas</h2>
        </div>
        <label className="st-field st-inline">
          <span className="st-mono">Tipo de racha</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as StreakKey)}>
            {Object.entries(STREAKS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {ordered.length ? (
          <div className="st-tablebox">
            <table className="st-table st-streaks" aria-label="Ranking de rachas">
              <thead>
                <tr>
                  <th scope="col">Puesto / jugador</th>
                  <th scope="col">Mejor racha</th>
                  <th scope="col">Actual</th>
                  <th scope="col">Inicio — final del récord</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((p) => {
                  const s = p[kind];
                  return (
                    <tr key={p.id}>
                      <th scope="row">
                        <span className="rk">{ranks.get(p.id)}</span>
                        <Link to="/jugadores/$playerId" params={{ playerId: p.id }}>
                          {nameOf(p)}
                        </Link>
                      </th>
                      <td>
                        <span className="st-inbar">
                          <b>{s.best.count}</b>
                          <i style={{ width: `${(s.best.count / longest) * 100}%` }} />
                        </span>
                      </td>
                      <td className={s.current.count ? "live" : undefined}>
                        {s.current.count > 0 && <Icon name="flame" size={14} />}
                        {s.current.count}
                        {s.current.count > 0 && <span className="hm-sr"> (viva)</span>}
                      </td>
                      <td className="dates">
                        {s.best.from && <MatchLink match={s.best.from} />}
                        {s.best.to && s.best.to.id !== s.best.from?.id && <MatchLink match={s.best.to} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="st-empty">Sin rachas registradas para esta métrica.</p>
        )}
        <p className="st-mono">Las rachas cuentan partidos seguidos del equipo en el período: un partido sin la acción la corta.</p>
      </section>

      <section className="st-card">
        <div className="st-hd">
          <span className="hm-kick" style={{ margin: 0 }}>
            Fechas señaladas <span className="st-new">nuevo</span>
          </span>
          <h2 className="st-h2">La colección de la temporada</h2>
          <p className="st-mono">
            {col.got.length} {col.got.length === 1 ? "cromo pegado" : "cromos pegados"} · los huecos dicen cuánto falta
          </p>
        </div>
        <div className="st-seg sm" role="group" aria-label="Filtrar hitos">
          {(
            [
              ["all", "Todos"],
              ["goals", "Goles"],
              ["assists", "Asistencias"],
              ["matchesPlayed", "Partidos"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => {
                setFilter(k);
                setVisible(12);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        {got.length + next.length ? (
          <ul className="st-stickers">
            {got.slice(0, visible).map((s, i) => (
              <li key={s.id} className="got" style={{ animationDelay: `${Math.min(i, 12) * 0.05}s` }}>
                <b>{s.value}</b>
                <small>{MS_LABEL[s.metric][s.value === 1 ? 0 : 1]}</small>
                <Link to="/jugadores/$playerId" params={{ playerId: s.playerId }}>
                  {names.get(s.playerId) ?? "Jugador"}
                </Link>
                {s.match && (
                  <Link to="/matches/$matchId" params={{ matchId: s.match.id }} className="st-mono">
                    vs {s.match.rival ?? "Rival"} ↗
                  </Link>
                )}
              </li>
            ))}
            {got.length <= visible &&
              next.slice(0, Math.max(0, visible - got.length)).map((s) => (
                <li key={s.id} className="slot">
                  <b>{s.value}</b>
                  <small>{MS_LABEL[s.metric][1]}</small>
                  <span>{names.get(s.playerId) ?? "Jugador"}</span>
                  <span className="st-mono">
                    faltan {s.left}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="st-empty">Sin hitos para este período.</p>
        )}
        {got.length + next.length > visible && (
          <button type="button" className="hm-ghostbtn st-sm" onClick={() => setVisible(visible + 12)}>
            Mostrar más hitos
          </button>
        )}
      </section>

      <section className="st-card">
        <h3 className="st-h3">Próximos hitos de gol</h3>
        <ol className="st-next">
          {nextGoals.map((p) => {
            const step = stepAfter(p.goals);
            return (
              <li key={p.id}>
                <Link to="/jugadores/$playerId" params={{ playerId: p.id }}>
                  {nameOf(p)}
                </Link>
                <span className="st-mono">
                  {p.goals} / {step}
                </span>
                <span className="tr">
                  <i style={{ width: `${(p.goals / step) * 100}%` }} />
                </span>
                <small>
                  Le {step - p.goals === 1 ? "falta 1 gol" : `faltan ${step - p.goals} goles`}
                </small>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function Team({ games }: { games: ClubMatch[] }) {
  const t = teamAnalysis(games);
  const none = new Map<string, string>();
  return (
    <>
      <div className="st-hd">
        <span className="hm-kick" style={{ margin: 0 }}>
          El equipo
        </span>
        <h2 className="st-h2">Récords del equipo</h2>
      </div>
      <div className="st-recs">
        <RecordCard i={0} title="Mayor margen de victoria" unit="goles" entries={teamRecords(games, "win")} names={none} />
        <RecordCard i={1} title="Más goles a favor" unit="goles" entries={teamRecords(games, "scored")} names={none} />
        <RecordCard i={2} title="Partido con más goles" unit="goles" entries={teamRecords(games, "total")} names={none} />
        <RecordCard i={3} title="Más goles encajados" unit="goles" entries={teamRecords(games, "conceded")} names={none} />
      </div>
      <div className="st-recs">
        <StreakCard i={0} title="Victorias consecutivas" data={t.winStreak} />
        <StreakCard i={1} title="Partidos sin perder" data={t.unbeatenStreak} />
        <StreakCard i={2} title="Partidos marcando" data={t.scoringStreak} />
        <StreakCard i={3} title="Portería a cero" data={t.cleanStreak} />
      </div>
    </>
  );
}

const EVO = { goals: "Goles", assists: "Asistencias", ga: "G+A", matchesPlayed: "Partidos", minutes: "Minutos registrados" } as const;
type EvoKey = keyof typeof EVO;
const evoValue = (g: PlayerAnalysis["series"][number], k: EvoKey) => (k === "minutes" ? (g.minutes ?? 0) : g[k]);

function Evolution({ rows, games, nameOf }: { rows: PlayerAnalysis[]; games: ClubMatch[]; nameOf: NameOf }) {
  const [metric, setMetric] = useState<EvoKey>("goals");
  const [order, setOrder] = useState<"goals" | "assists" | "ga" | "matchesPlayed" | "minutes">("goals");
  const candidates = rows.filter((p) => (metric === "minutes" ? p.tracked > 0 : true)).sort((a, b) => (metric === "minutes" ? b.minutes : b[metric]) - (metric === "minutes" ? a.minutes : a[metric]) || nameOf(a).localeCompare(nameOf(b)));
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = (picked ?? candidates.slice(0, 4).map((p) => p.id)).filter((id) => candidates.some((p) => p.id === id)).slice(0, 6);
  const [at, setAt] = useState<number | null>(null);
  const n = games.length;
  const cursor = at ?? n - 1;
  const lines = chosen.map((id, k) => {
    const p = rows.find((r) => r.id === id)!;
    let acc = 0;
    return { p, k, values: p.series.map((g) => (acc += evoValue(g, metric))) };
  });
  const max = Math.max(1, ...lines.flatMap((l) => l.values));
  const W = 600, H = 240, PAD = 28;
  const x = (i: number) => PAD + (n > 1 ? (i / (n - 1)) * (W - PAD * 2) : (W - PAD * 2) / 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((c) => c !== id) : chosen.length >= 6 ? chosen : [...chosen, id]);
  const m = games[cursor];
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => v >= 0 && a.indexOf(v) === i);
  const units = { goals: "G", assists: "A", ga: "G+A", matchesPlayed: "PJ", minutes: "min" } as const;
  return (
    <>
      <section className="st-card">
        <div className="st-hd">
          <span className="hm-kick" style={{ margin: 0 }}>
            Evolución acumulada
          </span>
          <h2 className="st-h2">La clasificación, partido a partido</h2>
        </div>
        <label className="st-field st-inline">
          <span className="st-mono">Métrica</span>
          <select
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as EvoKey);
              setPicked(null);
            }}
          >
            {Object.entries(EVO).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="st-chips" role="group" aria-label="Jugadores en la gráfica (máximo 6)">
          {candidates.map((p) => {
            const k = chosen.indexOf(p.id);
            return (
              <button key={p.id} type="button" aria-pressed={k >= 0} className={k >= 0 ? `c${k}` : undefined} disabled={k < 0 && chosen.length >= 6} onClick={() => toggle(p.id)}>
                {k >= 0 && <i />}
                {nameOf(p)}
              </button>
            );
          })}
        </div>
        {!n ? (
          <p className="st-empty">No hay partidos finalizados.</p>
        ) : !lines.length ? (
          <p className="st-empty">Selecciona jugadores con datos para ver su evolución.</p>
        ) : (
          <>
            <div className="st-evo">
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución de ${EVO[metric].toLowerCase()}: ${lines.map((l) => `${nameOf(l.p)} ${l.values[n - 1]}`).join(", ")}`} key={metric + chosen.join()}>
                {[0, 0.5, 1].map((k) => (
                  <g key={k}>
                    <line x1={PAD} x2={W - PAD} y1={y(max * k)} y2={y(max * k)} className="grid" />
                    <text x={PAD - 6} y={y(max * k) + 4} className="yl">
                      {Math.round(max * k)}
                    </text>
                  </g>
                ))}
                <line x1={x(cursor)} x2={x(cursor)} y1={PAD - 8} y2={H - PAD} className="cur" />
                {lines.map((l) => (
                  <g key={l.p.id} className={`c${l.k}`}>
                    <polyline points={l.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} pathLength={1} className="line" />
                    <circle cx={x(cursor)} cy={y(l.values[cursor])} r={5} className="dot" />
                  </g>
                ))}
                {ticks.map((i) => (
                  <text key={i} x={x(i)} y={H - 6} className="xl">
                    {formatDate(games[i].date).replace(/^[^,]*,\s*/, "").replace(/( de)? \d{4}$/, "")}
                  </text>
                ))}
              </svg>
            </div>
            <label className="st-range">
              <span className="st-mono">
                Partido {cursor + 1} de {n}
              </span>
              <input type="range" min={0} max={n - 1} value={cursor} onChange={(e) => setAt(Number(e.target.value))} />
            </label>
            <div className="st-evo-detail">
              <span className="st-mono">{formatDate(m.date)}</span>
              <Link to="/matches/$matchId" params={{ matchId: m.id }}>
                Piti {m.goalsFor}–{m.goalsAgainst} {m.rival ?? "Rival"} ↗
              </Link>
              <ul>
                {[...lines]
                  .sort((a, b) => b.values[cursor] - a.values[cursor])
                  .map((l) => (
                    <li key={l.p.id} className={`c${l.k}`}>
                      <i />
                      {nameOf(l.p)} <b>{l.values[cursor]}</b>
                    </li>
                  ))}
              </ul>
            </div>
            {metric === "minutes" && <p className="st-mono">Solo cuentan los minutos de actas completas.</p>}
          </>
        )}
      </section>
      <section className="st-card">
        <div className="st-hd">
          <span className="hm-kick" style={{ margin: 0 }}>
            Clasificación visual
          </span>
          <h2 className="st-h2">Ranking de jugadores</h2>
        </div>
        <label className="st-field st-inline">
          <span className="st-mono">Ordenar por</span>
          <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
            <option value="goals">Goles</option>
            <option value="assists">Asistencias</option>
            <option value="ga">Goles + asistencias</option>
            <option value="matchesPlayed">Partidos</option>
            <option value="minutes">Minutos</option>
          </select>
        </label>
        <Bars rows={order === "minutes" ? rows.filter((p) => p.tracked) : rows} value={(p) => p[order]} unit={units[order]} nameOf={nameOf} medals={order === "goals"} />
        <p className="st-mono">Los puestos se comparten en caso de empate (1, 2, 2, 4); los ceros no reciben medalla.</p>
      </section>
    </>
  );
}
