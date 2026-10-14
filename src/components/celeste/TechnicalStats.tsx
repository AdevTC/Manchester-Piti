// El juego en detalle (Celeste): the narrated actions of one match, a season, every season or one
// player — the match page's «Estadísticas» tab, the jugador page (after «Sus números») and /stats ›
// Análisis del juego. Recorded actions only, never estimates: every number comes from
// technicalAnalysis (functions/src/matchAnalysis), and the hosts show the panel only when there is some
// narration to read (hasAnalysisActions). Cards and segmented controls are the stats pages' own
// (st-card, st-seg, st-table…, from stats.css); technical-stats.css only lays out what is particular to it.
import { useId, useMemo, useState } from "react";
import { EVENT_LABELS, type ClubMatch, type MatchEvent } from "../../lib/clubData";
import { TECH_LABELS, pct, technicalAnalysis } from "../../lib/technicalAnalysis";
import { plural } from "../../lib/vestuario";
import { emptyTechnical, eventSide, OUTCOME_LABELS, type AnalysisEvent, type TechnicalStats } from "../../../functions/src/matchAnalysis";
import { PlayerLink } from "./PlayerLink";
import "../../styles/st-base.css";
import "./technical-stats.css";

type Metric = keyof TechnicalStats;
type Side = "us" | "opponent";
type Network = "passes" | "crosses";
export interface Person {
  id: string;
  name: string;
  number?: number | string | null;
}

const CATEGORIES = {
  "Pases y creación": ["passes", "passesCompleted", "passesFailed", "passesReceived", "keyPasses", "longPasses", "crosses", "crossesCompleted"],
  Remate: ["shots", "shotsOnTarget", "shotsOffTarget", "shotsBlocked", "shotsWoodwork", "shotGoals", "chancesCreated"],
  "Defensa y duelos": ["recoveries", "interceptions", "turnovers", "tackles", "tacklesWon", "clearances", "blocks", "saves", "dribbles", "dribblesWon", "duels", "duelsWon", "aerialDuels", "aerialDuelsWon"],
  "Balón parado y disciplina": ["cornersTaken", "throwIns", "goalKicks", "kickoffs", "offsides", "fouls", "foulsReceived"],
} as const satisfies Record<string, readonly Metric[]>;
type Category = keyof typeof CATEGORIES;
const CATEGORY_NAMES = Object.keys(CATEGORIES) as Category[];

const SIDES: [Side, string][] = [
  ["us", "El Piti"],
  ["opponent", "El rival"],
];
const NETWORKS: [Network, string][] = [
  ["passes", "Pases"],
  ["crosses", "Centros"],
];
const ZONES = [
  ["left", "Izquierda"],
  ["center", "Centro"],
  ["right", "Derecha"],
] as const;
/** The goals among the shots (analyseActions counts these four as shots on target that went in). */
const GOALS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_goal"]);

/** The network's circle: its centre and radius in the 360 × 360 drawing. */
const ORBIT = { cx: 180, cy: 180, r: 126 };

/** A shot's word in its tooltip: «Gol», its outcome, or what it was (a palo, a penalty missed). */
function shotWord(e: AnalysisEvent): string {
  if (GOALS.has(e.type)) return "Gol";
  if (e.outcome) return OUTCOME_LABELS[e.outcome];
  return EVENT_LABELS[e.type as MatchEvent["type"]] ?? e.type;
}

/** Everyone the matches name: called up, on the acta, or in one of its events. */
function involvedIds(matches: readonly ClubMatch[]): Set<string> {
  return new Set(
    matches.flatMap((m) => [
      ...(m.starters ?? []),
      ...(m.bench ?? []),
      ...(m.notCalled ?? []),
      ...Object.keys(m.ledger ?? {}),
      ...(m.events ?? []).flatMap((e) => [e.playerId, e.receiverId, e.assistPlayerId, e.inPlayerId].filter((id): id is string => !!id)),
    ]),
  );
}

export interface TechnicalStatsPanelProps {
  matches: readonly ClubMatch[];
  people: Person[];
  /** The player it opens on (the jugador page: him); none = the whole team. */
  initialPlayer?: string;
  /** The season the names belong to (their links keep it); none or «all» = no season. */
  seasonId?: string | null;
}

/** The same view consumes a single match, a season, all seasons or one player. */
export function TechnicalStatsPanel({ matches, people, initialPlayer = "", seasonId }: TechnicalStatsPanelProps) {
  const uid = useId();
  const data = useMemo(() => technicalAnalysis(matches), [matches]);
  const [selected, setSelected] = useState(initialPlayer);
  const [category, setCategory] = useState<Category>("Pases y creación");
  const [metric, setMetric] = useState<Metric>("passesCompleted");
  const [side, setSide] = useState<Side>("us");
  const [network, setNetwork] = useState<Network>("passes");

  const involved = involvedIds(matches);
  const roster = people.filter((p) => involved.has(p.id));
  const names = new Map(people.map((p) => [p.id, p]));
  const person = (id: string): Person => names.get(id) ?? { id, name: "Jugador", number: "—" };
  const nameLink = (id: string) => (
    <PlayerLink id={id} seasonId={seasonId} variant="quiet">
      {person(id).name}
    </PlayerLink>
  );
  const toggle = (id: string) => setSelected(selected === id ? "" : id);

  const row = selected ? (data.players[selected] ?? emptyTechnical()) : data.teams.us;
  const usName = selected ? person(selected).name : "El Piti";
  const knownPasses = row.passesCompleted + row.passesFailed;
  const knownShots = row.shotsOnTarget + row.shotsOffTarget + row.shotsBlocked + row.shotsWoodwork;
  const knownTackles = row.tackles - row.tacklesUnknown;
  const kpis: [string, string, string][] = [
    ["Precisión de pase", pct(row.passesCompleted, knownPasses), `${row.passesCompleted} / ${knownPasses} con resultado conocido · ${row.passesUnknown} sin resultado`],
    ["Remates a puerta", pct(row.shotsOnTarget, knownShots), `${row.shotsOnTarget} / ${knownShots} con destino conocido`],
    ["Conversión", pct(row.shotGoals, row.shots), `${plural(row.shotGoals, "gol", "goles")} en ${plural(row.shots, "remate", "remates")}`],
    ["Entradas ganadas", pct(row.tacklesWon, knownTackles), `${row.tacklesWon} / ${knownTackles} con resultado conocido · ${row.tacklesUnknown} sin resultado`],
  ];

  // Quién destaca / Todos los jugadores: everyone involved plus anyone with an action, best first.
  const rankings = [...new Set([...roster.map((p) => p.id), ...Object.keys(data.players)])]
    .map((id) => ({ ...person(id), stats: data.players[id] ?? emptyTechnical() }))
    .sort((a, b) => b.stats[metric] - a.stats[metric] || a.name.localeCompare(b.name));
  const maxRank = Math.max(1, ...rankings.map((r) => r.stats[metric]));
  // (equal values share a place: the first with that value gives it)
  const placeOf = (value: number) => rankings.findIndex((other) => other.stats[metric] === value) + 1;

  // La red: the players with a completed delivery, round the circle by dorsal; a node grows with his
  // recorded actions and the passes he received, a line with the deliveries between the two.
  const connectedIds = [...new Set(data.links.flatMap((l) => [l.from, l.to]))].sort((a, b) =>
    String(person(a).number).localeCompare(String(person(b).number), "es", { numeric: true }),
  );
  const step = (Math.PI * 2) / Math.max(1, connectedIds.length);
  const nodes = connectedIds.map((id, i) => ({
    ...person(id),
    x: ORBIT.cx + ORBIT.r * Math.cos(-Math.PI / 2 + i * step),
    y: ORBIT.cy + ORBIT.r * Math.sin(-Math.PI / 2 + i * step),
    n: (data.players[id]?.recordedActions ?? 0) + (data.players[id]?.passesReceived ?? 0),
  }));
  const maxNode = Math.max(1, ...nodes.map((n) => n.n));
  const byNode = new Map(nodes.map((n) => [n.id, n]));
  const edges = data.links
    .filter((l) => !selected || l.from === selected || l.to === selected)
    .map((l) => ({ ...l, n: network === "crosses" ? l.crosses : l.count }))
    .filter((l) => l.n > 0)
    .sort((a, b) => b.n - a.n);
  const maxEdge = Math.max(1, ...edges.map((e) => e.n));
  const delivery = network === "passes" ? "pases" : "centros";

  // Remates: ours (his, with a player chosen) or the rival's; the map only with coordinates.
  const shots = data.shots.filter((e) => eventSide(e) === side && (side === "opponent" || !selected || e.playerId === selected));
  const mapped = shots.filter((e) => e.x != null && e.y != null);
  const untimed = shots.filter((e) => e.minute == null).length;
  const binCount = Math.floor(Math.max(50, ...matches.map((m) => m.duration ?? 50), ...shots.map((e) => e.minute ?? 0)) / 5) + 1;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    minute: i * 5,
    shots: shots.filter((e) => e.minute != null && Math.floor(e.minute / 5) === i).length,
  }));
  const maxBin = Math.max(1, ...bins.map((b) => b.shots));

  const compare = CATEGORIES[category];
  const them = data.teams.opponent;
  const possession = data.teams.us.possessionsSeconds + them.possessionsSeconds;
  const complete = data.complete === data.games && data.games > 0;

  return (
    <section className="technical-stats" aria-label="Estadísticas detalladas">
      <header className="ts-head">
        <div className="st-hd">
          <span className="hm-kick" style={{ margin: 0 }}>
            Jugada a jugada · {plural(data.games, "partido", "partidos")}
          </span>
          <h2 className="st-h2">El juego en detalle</h2>
        </div>
        <label className="st-field ts-player">
          <span className="st-mono">Jugador</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Todo el equipo</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number ?? "—"} · {p.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="ts-coverage">
        <p>
          <b>{complete ? "Análisis completo" : "Cobertura parcial"}</b>
          {complete ? " · Cada jugada está apuntada." : " · No todas las jugadas están apuntadas: las cifras cuentan solo lo apuntado."}
        </p>
        <p className="st-mono">
          {data.complete} de {data.games} actas con narración completa · {plural(data.unknownTime, "acción", "acciones")} sin minuto.
        </p>
        {matches.length === 1 && matches[0].analysisNotes && <p className="st-mono">{matches[0].analysisNotes}</p>}
      </div>
      {!data.events.length && <p className="st-empty">El análisis aparecerá al incorporar las acciones al acta.</p>}

      <dl className="st-kpis ts-kpis">
        {kpis.map(([label, value, sub]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {value}
              <small>{sub}</small>
            </dd>
          </div>
        ))}
      </dl>

      <div className="ts-grid">
        <section className="st-card" aria-labelledby={`${uid}-net`}>
          <div className="ts-title">
            <h3 className="st-h3" id={`${uid}-net`}>
              La red de {delivery}
            </h3>
            <div className="st-seg" role="group" aria-label="Tipo de conexiones">
              {NETWORKS.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={network === k} onClick={() => setNetwork(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="st-mono">
            Cada círculo es un jugador: más grande, más intervenciones. Cada línea, {delivery} completados entre dos. El dibujo es esquemático, no son sus posiciones. Toca un dorsal para ver solo los suyos.
          </p>
          {nodes.length ? (
            <svg className="ts-network" viewBox="0 0 360 360" role="group" aria-label={`Red de ${delivery} completados`}>
              <circle className="ts-orbit" cx={ORBIT.cx} cy={ORBIT.cy} r={ORBIT.r} />
              {edges.map((l) => {
                const a = byNode.get(l.from);
                const b = byNode.get(l.to);
                if (!a || !b) return null;
                return (
                  <g key={`${l.from}>${l.to}`}>
                    <title>
                      {a.name} → {b.name}: {l.n}
                    </title>
                    <path d={`M ${a.x} ${a.y} Q ${ORBIT.cx} ${ORBIT.cy} ${b.x} ${b.y}`} fill="none" stroke="currentColor" strokeOpacity=".42" strokeWidth={1 + (7 * l.n) / maxEdge} />
                  </g>
                );
              })}
              {nodes.map((n) => (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.name}, ${n.n} intervenciones`}
                  aria-pressed={selected === n.id}
                  className={selected === n.id ? "ts-node selected" : "ts-node"}
                  onClick={() => toggle(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(n.id);
                    }
                  }}
                >
                  <circle cx={n.x} cy={n.y} r={14 + 11 * Math.sqrt(n.n / maxNode)} />
                  <text x={n.x} y={n.y + 5} textAnchor="middle">
                    {n.number ?? "·"}
                  </text>
                  <title>{n.name}</title>
                </g>
              ))}
            </svg>
          ) : (
            <p className="st-empty">Aún no hay {delivery} completados con quien da y quien recibe apuntados.</p>
          )}
          <div className="st-tablebox ts-scroll">
            <table className="st-table">
              <caption>Conexiones dirigidas · {plural(edges.length, "pareja", "parejas")}</caption>
              <thead>
                <tr>
                  <th scope="col">De</th>
                  <th scope="col">A</th>
                  <th scope="col">Completados</th>
                </tr>
              </thead>
              <tbody>
                {edges.map((l) => (
                  <tr key={`${l.from}>${l.to}`}>
                    <td>{nameLink(l.from)}</td>
                    <td>{nameLink(l.to)}</td>
                    <td>{l.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="st-card" aria-labelledby={`${uid}-shots`}>
          <div className="ts-title">
            <h3 className="st-h3" id={`${uid}-shots`}>
              Remates y zonas
            </h3>
            <div className="st-seg" role="group" aria-label="Equipo de remates">
              {SIDES.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={side === k} onClick={() => setSide(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="st-mono">
            {mapped.length} de {shots.length} remates con coordenadas. Ataque hacia arriba.
          </p>
          {mapped.length ? (
            <>
              <svg className="ts-pitch" viewBox="0 0 300 220" role="img" aria-label="Mapa de remates con posición registrada">
                <rect x="10" y="10" width="280" height="200" rx="12" />
                <path d="M90 10v50h120V10M120 10v20h60V10M10 150h280" />
                {mapped.map((e) => (
                  <g key={e.id}>
                    <circle cx={10 + (e.x ?? 0) * 2.8} cy={10 + (e.y ?? 0) * 2} r={GOALS.has(e.type) ? 7 : 4} className={GOALS.has(e.type) ? "goal" : "shot"} />
                    <title>
                      {e.playerId ? person(e.playerId).name : side === "opponent" ? "El rival" : "El Piti"} · {e.minute == null ? "Sin minuto" : `${e.minute}′`} · {shotWord(e)}
                    </title>
                  </g>
                ))}
              </svg>
              <p className="st-legend">
                <span>
                  <i className="ts-key-shot" aria-hidden="true" /> Remate
                </span>
                <span>
                  <i className="ts-key-goal" aria-hidden="true" /> Gol
                </span>
              </p>
            </>
          ) : (
            <p className="st-empty">Ningún remate tiene su sitio apuntado: se cuentan en las tablas, sin inventarles una posición.</p>
          )}
          <dl className="ts-zones">
            {ZONES.map(([z, label]) => (
              <div key={z}>
                <dt>{label}</dt>
                <dd>{shots.filter((e) => e.zone === z).length}</dd>
              </div>
            ))}
          </dl>
          <h4 className="ts-h4">Remates por tramo de 5 minutos</h4>
          <div className="ts-timeline">
            {bins.map((b) => (
              <div key={b.minute} title={`${b.minute}–${b.minute + 5} min: ${plural(b.shots, "remate", "remates")}`}>
                <b>{b.shots || ""}</b>
                <i style={{ height: `${4 + (65 * b.shots) / maxBin}px` }} />
                <small>{b.minute}′</small>
              </div>
            ))}
          </div>
          {untimed > 0 && <p className="st-mono">{untimed === 1 ? "1 remate sin minuto queda fuera de esta gráfica." : `${untimed} remates sin minuto quedan fuera de esta gráfica.`}</p>}
        </section>
      </div>

      <div className="st-seg ts-families" role="group" aria-label="Familias de estadísticas">
        {CATEGORY_NAMES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => {
              setCategory(c);
              setMetric(CATEGORIES[c][0]);
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="ts-grid">
        <section className="st-card" aria-labelledby={`${uid}-vs`}>
          <h3 className="st-h3" id={`${uid}-vs`}>
            {selected ? <>{nameLink(selected)} y el rival</> : "El Piti y el rival"}
          </h3>
          <p className="st-legend">
            <span>
              <i className="us" aria-hidden="true" /> {usName}
            </span>
            <span>
              <i className="them" aria-hidden="true" /> El rival
            </span>
          </p>
          {compare.map((k) => {
            const a = row[k];
            const b = them[k];
            return (
              <div className="ts-compare" key={k}>
                <div className="ts-compare-nums">
                  <b>
                    <span className="hm-sr">{usName}: </span>
                    {a}
                  </b>
                  <span>{TECH_LABELS[k]}</span>
                  <b>
                    <span className="hm-sr">El rival: </span>
                    {b}
                  </b>
                </div>
                <div className="ts-dual" aria-hidden="true">
                  <i className="us" style={{ width: `${a + b ? (a / (a + b)) * 100 : 50}%` }} />
                  <i className="them" style={{ width: `${a + b ? (b / (a + b)) * 100 : 50}%` }} />
                </div>
              </div>
            );
          })}
          <p className="st-mono">Compara acciones apuntadas; no equivale a la posesión del balón.</p>
          {possession > 0 && (
            <p className="st-mono">
              Posesión cronometrada: El Piti {pct(data.teams.us.possessionsSeconds, possession)} · {data.teams.us.possessionsSeconds} s / el rival {them.possessionsSeconds} s. Solo tramos registrados.
            </p>
          )}
        </section>

        <section className="st-card" aria-labelledby={`${uid}-top`}>
          <div className="ts-title">
            <h3 className="st-h3" id={`${uid}-top`}>
              Quién destaca
            </h3>
            <label className="st-field">
              <span className="hm-sr">Métrica del ranking</span>
              <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                {compare.map((k) => (
                  <option key={k} value={k}>
                    {TECH_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ol className="ts-rank">
            {rankings.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button type="button" aria-pressed={selected === r.id} onClick={() => setSelected(r.id)}>
                  <span>
                    {placeOf(r.stats[metric])}. {r.name}
                  </span>
                  <b>{r.stats[metric]}</b>
                  <i style={{ width: `${(r.stats[metric] / maxRank) * 100}%` }} />
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="st-card" aria-labelledby={`${uid}-all`}>
        <h3 className="st-h3" id={`${uid}-all`}>
          Todos los jugadores · {category.toLocaleLowerCase("es")}
        </h3>
        <div className="st-tablebox ts-scroll">
          <table className="st-table">
            <caption>Ordenados por {TECH_LABELS[metric].toLocaleLowerCase("es")}. Desliza para ver todas las columnas.</caption>
            <thead>
              <tr>
                <th scope="col">Jugador</th>
                {compare.map((k) => (
                  <th scope="col" key={k} aria-sort={metric === k ? "descending" : undefined}>
                    <button type="button" onClick={() => setMetric(k)}>
                      {TECH_LABELS[k]}
                      {metric === k ? " ↓" : ""}
                    </button>
                  </th>
                ))}
                {category === "Pases y creación" && <th scope="col">Precisión</th>}
              </tr>
            </thead>
            <tbody>
              {rankings.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    {`${r.number ?? "—"} · `}
                    {nameLink(r.id)}
                  </th>
                  {compare.map((k) => (
                    <td key={k}>{r.stats[k]}</td>
                  ))}
                  {category === "Pases y creación" && <td>{pct(r.stats.passesCompleted, r.stats.passesCompleted + r.stats.passesFailed)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="ts-method">
        <summary>Cómo se cuentan las acciones</summary>
        <p>
          Solo cuentan las acciones apuntadas en el acta. Los goles cuentan como remates a puerta; centros y pases largos forman parte de los pases. Un pase fallado suma una pérdida. Los porcentajes no estiman lo que falta.
        </p>
        <p>
          El porcentaje de pase divide completados entre completados y fallados. Los resultados desconocidos se indican aparte. Precisión de remate: a puerta entre remates con destino conocido; los palos y los bloqueados no se cuentan como tiros a puerta. Conversión: goles entre remates registrados. Una intercepción suma una recuperación; un pase fallado o regate perdido suma una pérdida. Los autogoles no se atribuyen como remates del equipo beneficiado.
        </p>
        <p>
          Los nodos miden acciones e intervenciones registradas, no todos los toques reales. No se calcula posesión a partir del número de pases ni xG sin información y un modelo adecuados. Corregir el acta recalcula todas estas cifras.
        </p>
      </details>
    </section>
  );
}
