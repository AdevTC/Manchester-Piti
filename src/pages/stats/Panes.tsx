// The tabs of the Celeste Estadísticas page: Resumen, Jugadores, Minutos, Rivales and Comparar
// (Explorar lives in Explorar.tsx). Every number comes from clubAnalytics / statsView.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatDate, type ClubMatch } from "../../lib/clubData";
import { competitionRanks, medalFor, metrics, metricValue, teamAnalysis, type PlayerAnalysis, type PlayerMetric } from "../../lib/clubAnalytics";
import { goalLinks, goalMinutes, minutesHeat, points, radarScores, rivalTable } from "../../lib/statsView";
import { scorersLine } from "../../lib/partidos";
import { Icon } from "../../components/celeste/icons";
import { OpponentBadge } from "../../components/club/OpponentBadge";
import { Bars, Constellation, GoalClock, HeatStrip, Radar, ResultsChart } from "./Charts";

type NameOf = (p: PlayerAnalysis) => string;
const show = (p: PlayerAnalysis, k: PlayerMetric) => metricValue(p, k) ?? "—";
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Head({ kick, title, children, isNew }: { kick: string; title: string; children?: React.ReactNode; isNew?: boolean }) {
  return (
    <div className="st-hd">
      <span className="hm-kick" style={{ margin: 0 }}>
        {kick} {isNew && <span className="st-new">nuevo</span>}
      </span>
      <h2 className="st-h2">{title}</h2>
      {children}
    </div>
  );
}

// ---------- Resumen
export function Resumen({ games, rows, nameOf, mvps }: { games: ClubMatch[]; rows: PlayerAnalysis[]; nameOf: NameOf; mvps: Map<string, number> }) {
  const t = teamAnalysis(games);
  const links = useMemo(() => goalLinks(games), [games]);
  const names = new Map(rows.map((p) => [p.id, nameOf(p)]));
  const mvpTop = [...mvps.entries()].sort((a, b) => b[1] - a[1])[0];
  const kpis: { k: string; v: string | number; sub?: string; isNew?: boolean; hl?: boolean; wide?: boolean }[] = [
    { k: "Partidos", v: t.played },
    { k: "Victorias", v: t.wins, hl: true },
    { k: "Empates", v: t.draws },
    { k: "Derrotas", v: t.losses },
    { k: "Goles a favor", v: t.gf, hl: true },
    { k: "Goles en contra", v: t.ga },
    { k: "Goles por partido", v: (t.played ? t.gf / t.played : 0).toFixed(1).replace(".", ",") },
    { k: "% de victorias", v: `${pct(t.wins, t.played)}%` },
    { k: "Puntos", v: points(games), sub: `de ${t.played * 3}`, isNew: true },
    { k: "Porterías a cero", v: t.cleanSheets, isNew: true },
    ...(mvpTop ? [{ k: "Más MVP", v: mvpTop[1], sub: names.get(mvpTop[0]) ?? "", isNew: true, wide: true }] : []),
  ];
  return (
    <div className="st-pane-in">
      <section aria-labelledby="st-kpi">
        <h2 className="hm-sr" id="st-kpi">
          Los números del equipo
        </h2>
        <dl className="st-kpis">
          {kpis.map((x, i) => (
            <div key={x.k} className={[x.hl && "hl", x.wide && "wide"].filter(Boolean).join(" ") || undefined} style={{ animationDelay: `${i * 0.04}s` }}>
              <dt>
                {x.k} {x.isNew && <span className="st-new">nuevo</span>}
              </dt>
              <dd>
                {x.v}
                {x.sub && <small>{x.sub}</small>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="st-card" aria-labelledby="st-perf">
        <Head kick="Resultados recientes" title="Rendimiento del equipo">
          <p className="st-mono">Arriba los nuestros, abajo los suyos. Toca una columna para abrir el partido.</p>
        </Head>
        <span id="st-perf" className="hm-sr">
          Rendimiento del equipo
        </span>
        <ResultsChart games={games} />
        <p className="st-legend">
          <span>
            <i className="us" /> goles a favor
          </span>
          <span>
            <i className="them" /> goles en contra
          </span>
          <span>Últimos {Math.min(12, games.length)} partidos</span>
        </p>
      </section>
      <div className="st-two">
        <section className="st-card" aria-labelledby="st-sky-t">
          <Head kick="Asistente → goleador" title="La constelación" isNew />
          <span id="st-sky-t" className="hm-sr">
            Conexiones de gol
          </span>
          <Constellation rows={rows} links={links} nameOf={nameOf} />
          <h3 className="st-h3">Conexiones de gol</h3>
          {links.length ? (
            <ol className="st-duos">
              {links.slice(0, 5).map((l) => (
                <li key={l.from + l.to}>
                  <Link to="/jugadores/$playerId" params={{ playerId: l.from }}>
                    {names.get(l.from) ?? "Jugador"}
                  </Link>
                  <Icon name="send" size={14} />
                  <Link to="/jugadores/$playerId" params={{ playerId: l.to }}>
                    {names.get(l.to) ?? "Jugador"}
                  </Link>
                  <b>
                    {l.n} {l.n === 1 ? "gol" : "goles"}
                  </b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="st-empty">Aún no hay asistencias vinculadas a goles en este período.</p>
          )}
        </section>
        <section className="st-card" aria-labelledby="st-clock-t">
          <Head kick="Minuto a minuto" title="El reloj de goles" isNew />
          <span id="st-clock-t" className="hm-sr">
            El reloj de goles
          </span>
          <GoalClock games={games} />
        </section>
      </div>
    </div>
  );
}

// ---------- Jugadores
function exportCsv(rows: PlayerAnalysis[], nameOf: NameOf) {
  const quote = (value: unknown) => '"' + String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const keys = Object.keys(metrics) as PlayerMetric[];
  const lines = [["Jugador", ...keys.map((k) => metrics[k])], ...rows.map((p) => [nameOf(p), ...keys.map((k) => metricValue(p, k))])];
  const url = URL.createObjectURL(new Blob(["﻿" + lines.map((line) => line.map(quote).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "manchester-piti-estadisticas.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const FIXED: PlayerMetric[] = ["matchesPlayed", "goals", "assists", "minutes", "yellowCards", "redCards"];
const SHORT: Partial<Record<PlayerMetric, string>> = { matchesPlayed: "PJ", goals: "G", assists: "A", minutes: "Min", yellowCards: "TA", redCards: "TR", ga: "G+A" };

export function Jugadores({ rows, nameOf }: { rows: PlayerAnalysis[]; nameOf: NameOf }) {
  const [metric, setMetric] = useState<PlayerMetric>("goals");
  const [query, setQuery] = useState("");
  const heat = useMemo(() => new Map(minutesHeat(rows).map((h) => [h.id, h.cells.slice(-10)])), [rows]);
  const sorted = [...rows].sort((a, b) => (metricValue(b, metric) ?? -1) - (metricValue(a, metric) ?? -1) || nameOf(a).localeCompare(nameOf(b)));
  const q = query.toLowerCase().trim();
  const filtered = sorted.filter((p) => [p.firstName, p.lastName, p.shirtName, p.number].join(" ").toLowerCase().includes(q));
  const goalRanks = competitionRanks(rows, (p) => p.goals);
  const metricRanks = competitionRanks(rows, (p) => metricValue(p, metric) ?? -1);
  const cols = FIXED.filter((k) => k !== metric);
  return (
    <div className="st-pane-in">
      <section className="st-card" aria-labelledby="st-pl">
        <Head kick="La tabla" title="Datos de jugadores">
          <p className="st-mono">«—» indica que el dato no está registrado</p>
        </Head>
        <span id="st-pl" className="hm-sr">
          Datos de jugadores
        </span>
        <div className="st-tools">
          <label className="st-field">
            <span className="st-mono">Métrica</span>
            <select aria-label="Ordenar estadísticas" value={metric} onChange={(e) => setMetric(e.target.value as PlayerMetric)}>
              {Object.entries(metrics).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="st-search">
            <Icon name="search" size={18} />
            <span className="hm-sr">Buscar en estadísticas</span>
            <input type="search" placeholder="Buscar jugador…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button type="button" className="hm-ghostbtn st-sm" onClick={() => exportCsv(filtered, nameOf)}>
            <Icon name="download" size={16} />
            Exportar CSV
          </button>
        </div>
        {filtered.length ? (
          <div className="st-tablebox">
            <table className="st-table" aria-label="Datos de jugadores">
              <thead>
                <tr>
                  <th scope="col">Puesto / jugador</th>
                  <th scope="col" className="sel">
                    {metrics[metric]}
                  </th>
                  {cols.map((k) => (
                    <th scope="col" key={k}>
                      <abbr title={metrics[k]}>{SHORT[k] ?? metrics[k]}</abbr>
                    </th>
                  ))}
                  <th scope="col" className="hs">
                    Últimas jornadas <span className="st-new">nuevo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const medal = medalFor(goalRanks.get(p.id), p.goals);
                  const v = metricValue(p, metric);
                  return (
                    <tr key={p.id} style={{ animationDelay: `${Math.min(i, 14) * 0.03}s` }}>
                      <th scope="row">
                        <span className={`rk${medal ? " " + medal : ""}`} title={medal ? `N.º ${goalRanks.get(p.id)} goleador` : undefined}>
                          {v !== null && v > 0 ? metricRanks.get(p.id) : "—"}
                        </span>
                        <Link to="/jugadores/$playerId" params={{ playerId: p.id }}>
                          {nameOf(p)}
                        </Link>
                      </th>
                      <td className="sel">{show(p, metric)}</td>
                      {cols.map((k) => (
                        <td key={k}>{show(p, k)}</td>
                      ))}
                      <td className="hs">
                        <HeatStrip cells={heat.get(p.id) ?? []} label={nameOf(p)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="st-empty">Ningún jugador coincide con la búsqueda.</p>
        )}
        <p className="st-legend">
          <span>
            <i className="rk gold" /> 1.º goleador
          </span>
          <span>
            <i className="rk silver" /> 2.º
          </span>
          <span>
            <i className="rk bronze" /> 3.º
          </span>
          <span>Jornadas: más intenso, más minutos · número, goles</span>
        </p>
      </section>
    </div>
  );
}

// ---------- Minutos
export function Minutos({ rows, games, nameOf }: { rows: PlayerAnalysis[]; games: ClubMatch[]; nameOf: NameOf }) {
  const tracked = games.filter((m) => m.ledger && Object.keys(m.ledger).length).length;
  const sorted = [...rows].sort((a, b) => (b.tracked ? b.minutes : -1) - (a.tracked ? a.minutes : -1) || nameOf(a).localeCompare(nameOf(b)));
  const heat = minutesHeat(sorted);
  const last = games.slice(-12);
  const cut = games.length - last.length;
  const cell = (p: PlayerAnalysis, v: number) => (p.tracked ? v : "—");
  return (
    <div className="st-pane-in">
      <section className="st-card" aria-labelledby="st-min">
        <Head kick="Participación" title="Minutos y convocatorias">
          <p className="st-mono">
            Hay {tracked} de {games.length} partidos con seguimiento de minutos; el historial anterior no se estima.
          </p>
        </Head>
        <span id="st-min" className="hm-sr">
          Minutos y convocatorias
        </span>
        <div className="st-tablebox">
          <table className="st-table" aria-label="Minutos y convocatorias">
            <thead>
              <tr>
                <th scope="col">Jugador</th>
                <th scope="col" className="sel">
                  Minutos
                </th>
                <th scope="col">Titular</th>
                <th scope="col">Suplente inicial</th>
                <th scope="col">Entradas</th>
                <th scope="col">Salidas</th>
                <th scope="col">No convocado</th>
                <th scope="col">Actas</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    <Link to="/jugadores/$playerId" params={{ playerId: p.id }}>
                      {nameOf(p)}
                    </Link>
                  </th>
                  <td className="sel">{p.tracked ? p.minutes : "—"}</td>
                  <td>{cell(p, p.starts)}</td>
                  <td>{cell(p, p.bench)}</td>
                  <td>{cell(p, p.subIn)}</td>
                  <td>{cell(p, p.subOut)}</td>
                  <td>{cell(p, p.notCalled)}</td>
                  <td>{p.tracked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="st-two">
        <section className="st-card" aria-labelledby="st-heat">
          <Head kick="Jugador × jornada" title="El mapa de minutos" isNew>
            <p className="st-mono">Cada casilla, un partido: cuanto más intensa, más minutos.</p>
          </Head>
          <span id="st-heat" className="hm-sr">
            Mapa de minutos
          </span>
          <div className="st-tablebox">
            <table className="st-heatmap" aria-label="Mapa de minutos" style={{ ["--n" as string]: last.length }}>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="hm-sr">Jugador</span>
                  </th>
                  {last.map((m, i) => (
                    <th scope="col" key={m.id}>
                      <Link to="/matches/$matchId" params={{ matchId: m.id }} aria-label={`${m.rival ?? "Rival"}, ${formatDate(m.date)}`}>
                        J{cut + i + 1}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heat.map((h) => {
                  const p = sorted.find((r) => r.id === h.id)!;
                  return (
                    <tr key={h.id}>
                      <th scope="row">{nameOf(p)}</th>
                      {h.cells.slice(-12).map((c) => (
                        <td key={c.matchId} className={c.played ? undefined : "no"} style={{ ["--l" as string]: c.level }} title={c.minutes !== null ? `${c.minutes}′` : c.played ? "Jugó" : "No jugó"}>
                          <span className="hm-sr">{c.minutes !== null ? `${c.minutes} minutos` : c.played ? "jugó" : "no jugó"}</span>
                          {c.goals > 0 && <b aria-hidden="true">{c.goals}</b>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="st-card" aria-labelledby="st-dist">
          <Head kick="Reparto" title="Distribución de minutos" />
          <span id="st-dist" className="hm-sr">
            Distribución de minutos
          </span>
          <Bars rows={rows.filter((p) => p.tracked)} value={(p) => p.minutes} unit="min" nameOf={nameOf} />
        </section>
      </div>
    </div>
  );
}

// ---------- Rivales
export function Rivales({ games, rows }: { games: ClubMatch[]; rows: PlayerAnalysis[] }) {
  const table = useMemo(() => rivalTable(games), [games]);
  const [open, setOpen] = useState<string | null>(null);
  const names = new Map(rows.map((p) => [p.id, p.shirtName || p.firstName || "Jugador"]));
  const nameOfId = (id: string) => names.get(id) ?? "Jugador";
  return (
    <div className="st-pane-in">
      <section className="st-card" aria-labelledby="st-riv">
        <Head kick="Cara a cara" title="Historial por rival">
          <p className="st-mono">Balance de enfrentamientos en el período. Toca un rival para ver sus partidos.</p>
        </Head>
        <span id="st-riv" className="hm-sr">
          Historial por rival
        </span>
        <ul className="st-rivals">
          {table.map((r) => {
            const isOpen = open === r.key;
            return (
              <li key={r.key} className={isOpen ? "open" : undefined}>
                <button type="button" className="st-rival" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.key)}>
                  <OpponentBadge name={r.name} logo={r.logo} initials={r.initials} size={40} />
                  <span className="nm">{r.name}</span>
                  <span className="nums">
                    <span>
                      <small>PJ</small>
                      {r.played}
                    </span>
                    <span>
                      <small>V</small>
                      {r.wins}
                    </span>
                    <span>
                      <small>E</small>
                      {r.draws}
                    </span>
                    <span>
                      <small>D</small>
                      {r.losses}
                    </span>
                    <span>
                      <small>GF</small>
                      {r.gf}
                    </span>
                    <span>
                      <small>GC</small>
                      {r.ga}
                    </span>
                  </span>
                  <span className="bal" role="img" aria-label={`${r.wins} victorias, ${r.draws} empates y ${r.losses} derrotas`}>
                    {r.wins > 0 && <i className="v" style={{ flexGrow: r.wins }}>V</i>}
                    {r.draws > 0 && <i className="e" style={{ flexGrow: r.draws }}>E</i>}
                    {r.losses > 0 && <i className="d" style={{ flexGrow: r.losses }}>D</i>}
                  </span>
                  <span className="chev" aria-hidden="true">
                    <Icon name="down" size={18} />
                  </span>
                </button>
                {isOpen && (
                  <ol className="st-rgames">
                    <li className="st-mono">
                      Detalle <span className="st-new">nuevo</span>
                    </li>
                    {r.games.map((m) => {
                      const gm = goalMinutes(m.events);
                      const d = m.duration || 50;
                      return (
                        <li key={m.id}>
                          <Link to="/matches/$matchId" params={{ matchId: m.id }}>
                            <b>
                              {m.goalsFor}–{m.goalsAgainst}
                            </b>
                            <span>{formatDate(m.date)}</span>
                            <small>{scorersLine(m.events, nameOfId) || "Sin goles del Piti"}</small>
                            <span className="tl" aria-hidden="true">
                              {gm.us.map((x, i) => (
                                <i key={"u" + i} className="us" style={{ left: `${(x / d) * 100}%` }} />
                              ))}
                              {gm.them.map((x, i) => (
                                <i key={"t" + i} className="them" style={{ left: `${(x / d) * 100}%` }} />
                              ))}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ---------- Comparar
export function Comparar({ rows, nameOf, games }: { rows: PlayerAnalysis[]; nameOf: NameOf; games: number }) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  if (rows.length < 2) return <p className="st-empty">Se necesitan al menos dos jugadores en este período.</p>;
  const lp = rows.find((p) => p.id === left) ?? rows[0];
  const rp = rows.find((p) => p.id === right && p.id !== lp.id) ?? rows.find((p) => p.id !== lp.id)!;
  const keys = Object.keys(metrics) as PlayerMetric[];
  const wins = keys.reduce(
    (acc, k) => {
      const a = metricValue(lp, k), b = metricValue(rp, k);
      if (a === null || b === null || a === b) return acc;
      const lowerBetter = k === "yellowCards" || k === "redCards" || k === "doubleYellows" || k === "penaltyMissed" || k === "penaltyCommitted" || k === "notCalled";
      if (a > b !== lowerBetter) acc.a++;
      else acc.b++;
      return acc;
    },
    { a: 0, b: 0 },
  );
  const pick = (id: string, set: (v: string) => void, exclude?: string, label?: string) => (
    <label className="st-field">
      <span className="st-mono">{label}</span>
      <select aria-label={label} value={id} onChange={(e) => set(e.target.value)}>
        {rows
          .filter((p) => p.id !== exclude)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {nameOf(p)}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <div className="st-pane-in">
      <section className="st-card" aria-labelledby="st-cmp">
        <Head kick="Cara a cara" title="Comparar jugadores" />
        <span id="st-cmp" className="hm-sr">
          Comparar jugadores
        </span>
        <div className="st-vs">
          {pick(lp.id, setLeft, undefined, "Primer jugador")}
          <button
            type="button"
            className="st-swap"
            aria-label="Intercambiar jugadores"
            onClick={() => {
              setLeft(rp.id);
              setRight(lp.id);
            }}
          >
            <Icon name="swap" size={18} />
          </button>
          {pick(rp.id, setRight, lp.id, "Segundo jugador")}
        </div>
        <div className="st-vs-names">
          <Link to="/jugadores/$playerId" params={{ playerId: lp.id }}>
            {nameOf(lp)} ↗
          </Link>
          <b>VS</b>
          <Link to="/jugadores/$playerId" params={{ playerId: rp.id }}>
            {nameOf(rp)} ↗
          </Link>
        </div>
        <div className="st-two st-cmp-top">
          <Radar a={radarScores(lp, rows, games)} b={radarScores(rp, rows, games)} aLabel={nameOf(lp)} bLabel={nameOf(rp)} />
          <p className="st-tally">
            <span className="st-new">nuevo</span>
            <b>{wins.a === wins.b ? "Empate técnico" : `${nameOf(wins.a > wins.b ? lp : rp)} manda`}</b>
            <span>
              Gana en {Math.max(wins.a, wins.b)} de las {keys.length} métricas
              {wins.a !== wins.b && `; ${nameOf(wins.a > wins.b ? rp : lp)}, en ${Math.min(wins.a, wins.b)}`}.
            </span>
          </p>
        </div>
        <ol className="st-cmp">
          {keys.map((k) => {
            const a = metricValue(lp, k), b = metricValue(rp, k);
            const both = a !== null && b !== null && a + b > 0;
            return (
              <li key={k}>
                <b className={both && a! > b! ? "win" : undefined}>{a ?? "—"}</b>
                <span className="lb">
                  {metrics[k]}
                  {both && (
                    <span className="split" aria-hidden="true">
                      <i style={{ flexGrow: a! }} />
                      <i style={{ flexGrow: b! }} />
                    </span>
                  )}
                </span>
                <b className={both && b! > a! ? "win" : undefined}>{b ?? "—"}</b>
              </li>
            );
          })}
        </ol>
        <p className="st-mono">Los minutos y convocatorias solo incluyen actas completas. El radar compara con lo mejor de la plantilla en el período.</p>
      </section>
    </div>
  );
}
