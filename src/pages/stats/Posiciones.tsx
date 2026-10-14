// The «Posiciones» tab of the Celeste Estadísticas page: «Por posición» — the club's night pitch with the
// 13 positions (each disc sized by its minutes, with its code, minutes and «el dueño»), a sortable table
// and the players of the selected position — and «Por sistema», the record of every system played.
// Every number comes from lib/positionStats (the actas' positionsPlayed / positionEvents and `system`).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerAnalysis } from "../../lib/clubAnalytics";
import { PLAYED_EMPTY, clubPositions, playerPositions, systemRecord, type ClubPosLine, type SystemLine } from "../../lib/positionStats";
import { POSITIONS, POS_CODES, type PosCode } from "../../lib/positions";
import { isFormationName, systemDef } from "../../lib/formations";
import { isCompleted } from "../../../functions/src/matchEngine";
import { fmtMinutes } from "../../lib/derived/minutes";
import type { MvpOf } from "../../lib/derived/mvpOf";

type NameOf = (p: PlayerAnalysis) => string;
const full = (code: PosCode) => `${POSITIONS[code].name} (${code})`;
const mins = (n: number) => fmtMinutes(n);
const comma = (n: number) => n.toFixed(2).replace(".", ",");
const minutesWord = (n: number) => `${n} ${n === 1 ? "minuto" : "minutos"}`;
/** Below this card width the detail panel sits under the pitch (stats.css `@container st-pos`). */
const SIDE_BY_SIDE = 760;
const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Where each position sits on the stats pitch (% of its width and height; our goal at the bottom). The
 * catalogue's order and sides, with the central column (DC · MCO · MC · MCD · DFC · LIB · POR) spread
 * evenly so every disc keeps its two label lines clear of the next one, from 296 px wide.
 */
const PITCH_SPOTS: Record<PosCode, readonly [number, number]> = {
  DC: [50, 9],
  EI: [15, 15],
  ED: [85, 15],
  MCO: [50, 22.5],
  MI: [15, 35.5],
  MD: [85, 35.5],
  MC: [50, 36],
  MCD: [50, 49.5],
  LI: [14, 61],
  LD: [86, 61],
  DFC: [50, 63],
  LIB: [50, 76.5],
  POR: [50, 90],
};
/** Disc diameter in % of the pitch width: never played, then √(minutes / the most played). */
const DISC_IDLE = 6.5;
const DISC_MIN = 8;
const DISC_SPAN = 4.5;
const discSize = (minutes: number, max: number) => (minutes > 0 ? DISC_MIN + DISC_SPAN * Math.sqrt(minutes / Math.max(1, max)) : DISC_IDLE);

type SortKey = "pos" | "min" | "players" | "g" | "a" | "owner";
type Sort = { key: SortKey; dir: 1 | -1 };
const COLUMNS: { key: SortKey; label: string; title?: string; first: 1 | -1; className?: string }[] = [
  { key: "pos", label: "Posición", first: 1 },
  { key: "min", label: "Min", title: "Minutos", first: -1 },
  { key: "players", label: "Jugadores", first: -1, className: "jug" },
  { key: "g", label: "G", title: "Goles", first: -1 },
  { key: "a", label: "A", title: "Asistencias", first: -1 },
  { key: "owner", label: "Dueño", first: 1 },
];

function Head({ kick, title, id, children }: { kick: string; title: string; id: string; children?: React.ReactNode }) {
  return (
    <div className="st-hd">
      <span className="hm-kick" style={{ margin: 0 }}>
        {kick} <span className="st-new">nuevo</span>
      </span>
      <h2 className="st-h2" id={id}>
        {title}
      </h2>
      {children}
    </div>
  );
}

export function Posiciones({ games, rows, nameOf, mvpOf }: { games: ClubMatch[]; rows: PlayerAnalysis[]; nameOf: NameOf; /** The shared MVP reader (derived/mvpOf), for the ratings by position. */ mvpOf?: MvpOf }) {
  return (
    <div className="st-pane-in">
      <PorPosicion games={games} rows={rows} nameOf={nameOf} mvpOf={mvpOf} />
      <PorSistema games={games} />
    </div>
  );
}

// ---------- Por posición
function PorPosicion({ games, rows, nameOf, mvpOf }: { games: ClubMatch[]; rows: PlayerAnalysis[]; nameOf: NameOf; mvpOf?: MvpOf }) {
  const names = useMemo(() => new Map(rows.map((p) => [p.id, nameOf(p)])), [rows, nameOf]);
  const firsts = useMemo(() => new Map(rows.map((p) => [p.id, p.firstName?.trim() || nameOf(p)])), [rows, nameOf]);
  const nameOfId = (id: string) => names.get(id) ?? "Jugador";
  const ownerOf = (l: ClubPosLine) => (l.owner ? (firsts.get(l.owner.id) ?? "Jugador") : "—");
  const lines = useMemo(() => clubPositions(games, (id) => names.get(id) ?? id), [games, names]);
  // who played each position, from his own «ha jugado de» lines (the same rounding as the club's)
  const byCode = useMemo(() => {
    const ids = new Set([...rows.map((p) => p.id), ...games.flatMap((m) => Object.keys(m.ledger ?? {}))]);
    const out = new Map<PosCode, { id: string; minutes: number }[]>();
    for (const id of ids) for (const l of playerPositions(id, games, mvpOf).lines) out.set(l.code, [...(out.get(l.code) ?? []), { id, minutes: l.minutes }]);
    for (const list of out.values()) list.sort((a, b) => b.minutes - a.minutes || (names.get(a.id) ?? a.id).localeCompare(names.get(b.id) ?? b.id, "es"));
    return out;
  }, [rows, games, names, mvpOf]);
  const estimated = useMemo(() => games.filter((m) => isCompleted(m) && Object.values(m.ledger ?? {}).some((r) => r?.positionsEstimated === true)).length, [games]);
  // the pick remembers the data it was made on: after a season change, a position without minutes
  // there is no longer picked (no pressed spot for a row the table hides)
  const [pick, setPick] = useState<{ code: PosCode; lines: ClubPosLine[] } | null>(null);
  const picked = pick && (pick.lines === lines || (lines.find((l) => l.code === pick.code)?.minutes ?? 0) > 0) ? pick.code : null;
  const [sort, setSort] = useState<Sort>({ key: "min", dir: -1 });
  // on the phone the detail is under the pitch: a pick on the pitch brings it into view (never on mount)
  const [jump, setJump] = useState(0);
  const posRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!jump || !posRef.current || posRef.current.getBoundingClientRect().width >= SIDE_BY_SIDE) return;
    detailRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [jump]);

  const played = lines.filter((l) => l.minutes > 0);
  const max = Math.max(1, ...played.map((l) => l.minutes));
  const top = [...played].sort((a, b) => b.minutes - a.minutes)[0];
  const toggle = (code: PosCode) => setPick(picked === code ? null : { code, lines });
  const pickSpot = (code: PosCode) => {
    if (picked !== code) setJump((n) => n + 1);
    toggle(code);
  };
  const value = (l: ClubPosLine, key: SortKey): number | string =>
    key === "pos" ? POS_CODES.indexOf(l.code) : key === "min" ? l.minutes : key === "players" ? l.players : key === "g" ? l.goals : key === "a" ? l.assists : ownerOf(l);
  const sorted = [...played].sort((a, b) => {
    const x = value(a, sort.key), y = value(b, sort.key);
    const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
    return d * sort.dir || POS_CODES.indexOf(a.code) - POS_CODES.indexOf(b.code);
  });
  const sortBy = (key: SortKey) => setSort(sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: COLUMNS.find((c) => c.key === key)!.first });
  const sel = picked ? lines.find((l) => l.code === picked)! : null;
  const selPlayers = picked ? (byCode.get(picked) ?? []) : [];
  const [sx, sy] = picked ? PITCH_SPOTS[picked] : [50, 50];

  return (
    <section className="st-card st-posc" aria-labelledby="st-pos-t">
      <Head kick="Por posición" title="¿De quién es cada puesto?" id="st-pos-t">
        <p className="st-mono">Minutos por posición exacta, según las actas. Cuanto más grande el círculo, más minutos; debajo, su dueño: quien más ha jugado ahí.</p>
      </Head>
      {!played.length ? (
        <>
          <p className="st-empty">{PLAYED_EMPTY}</p>
          <p className="st-mono">Las posiciones salen de la pizarra oficial de cada partido (o de la preferida de cada jugador si no la hubo) al publicar el acta.</p>
        </>
      ) : (
        <div className="st-pos" ref={posRef}>
          <div className="st-pos-field">
            <div className={`st-pitch${picked ? " has-pick" : ""}`} role="group" aria-label="El campo del club: los 13 puestos, con sus minutos y su dueño" style={{ ["--sx" as string]: `${sx}%`, ["--sy" as string]: `${sy}%` }}>
              <svg viewBox="0 0 100 175" aria-hidden="true" className="st-pitch-lines">
                <rect x="3" y="3" width="94" height="169" rx="2" />
                <path d="M3 87.5h94M22 3v25h56V3M36 3v9h28V3M22 172v-25h56v25M36 172v-9h28v9M42 3V.8h16V3M42 172v2.2h16V172" />
                <circle cx="50" cy="87.5" r="11" />
                <circle cx="50" cy="87.5" r=".8" className="dot" />
              </svg>
              {POS_CODES.map((code, i) => {
                const l = lines.find((x) => x.code === code)!;
                const [x, y] = PITCH_SPOTS[code];
                const zero = l.minutes <= 0;
                const on = picked === code;
                const share = l.owner && l.minutes > 0 ? Math.min(1, l.owner.minutes / l.minutes) : 0;
                // the visible text (code, «320′», owner) stays inside the accessible name
                const label = zero
                  ? `${code} · ${POSITIONS[code].name}: Sin estrenar`
                  : `${code} · ${POSITIONS[code].name}: ${mins(l.minutes)}, ${minutesWord(Math.round(l.minutes))}; el dueño, ${ownerOf(l)}, con ${minutesWord(Math.round(l.owner?.minutes ?? 0))}`;
                return (
                  <button
                    key={code}
                    type="button"
                    className={`st-spot${zero ? " zero" : ""}${on ? " on" : ""}${top?.code === code ? " top" : ""}`}
                    style={{ left: `${x}%`, top: `${y}%`, ["--d" as string]: `${discSize(l.minutes, max).toFixed(2)}cqw`, ["--share" as string]: share.toFixed(3), animationDelay: `${0.1 + i * 0.045}s` } as CSSProperties}
                    aria-pressed={on}
                    aria-label={label}
                    onClick={() => pickSpot(code)}
                  >
                    <span className="disc">
                      <b>{code}</b>
                    </span>
                    {zero ? (
                      <span className="mn idle">Sin estrenar</span>
                    ) : (
                      <>
                        <span className="mn">{mins(l.minutes)}</span>
                        <span className="ow">{ownerOf(l)}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="st-legend">
              <span>
                <i className="st-pos-k size" /> tamaño: minutos
              </span>
              <span>
                <i className="st-pos-k ring" /> aro: parte del dueño
              </span>
              <span>
                <i className="st-pos-k idle" /> sin estrenar
              </span>
            </p>
          </div>
          <div className="st-pos-side">
            <div className="st-posd" aria-live="polite" ref={detailRef}>
              {sel ? (
                <>
                  <h3 className="st-h3">{full(sel.code)}</h3>
                  {sel.minutes > 0 ? (
                    <>
                      <p className="st-mono">
                        <b>{mins(sel.minutes)}</b> entre {sel.players} {sel.players === 1 ? "jugador" : "jugadores"} · {sel.goals} G · {sel.assists} A
                      </p>
                      <ol className="st-posd-list" aria-label={`Quién ha jugado de ${full(sel.code)}`}>
                        {selPlayers.map((p, i) => (
                          <li key={p.id} className={i === 0 ? "own" : undefined}>
                            <Link to="/jugadores/$playerId" params={{ playerId: p.id }}>
                              {nameOfId(p.id)}
                            </Link>
                            <span className="tr" aria-hidden="true">
                              <i style={{ width: `${(p.minutes / Math.max(1, selPlayers[0].minutes)) * 100}%` }} />
                            </span>
                            <b>{mins(p.minutes)}</b>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p className="st-empty">Nadie ha jugado de {full(sel.code)} en este período.</p>
                  )}
                </>
              ) : (
                <>
                  {top && (
                    <p className="st-pos-lead">
                      <small>El puesto más pisado</small>
                      <b>{full(top.code)}</b>
                      <span>
                        {mins(top.minutes)} · dueño {ownerOf(top)}
                      </span>
                    </p>
                  )}
                  <p className="st-mono">Toca un puesto en el campo o en la tabla para ver quién lo ha jugado.</p>
                </>
              )}
            </div>
            <div className="st-tablebox">
              <table className="st-table st-post" aria-label="Minutos por posición">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined} className={[c.className, sort.key === c.key && "sel"].filter(Boolean).join(" ") || undefined}>
                        <button type="button" onClick={() => sortBy(c.key)}>
                          {c.title ? <abbr title={c.title}>{c.label}</abbr> : c.label}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((l) => (
                    <tr key={l.code} className={picked === l.code ? "on" : undefined}>
                      <th scope="row">
                        <button type="button" aria-pressed={picked === l.code} onClick={() => toggle(l.code)}>
                          {POSITIONS[l.code].name} <span className="cd">({l.code})</span>
                        </button>
                      </th>
                      <td>{mins(l.minutes)}</td>
                      <td className="jug">{l.players}</td>
                      <td>{l.goals}</td>
                      <td>{l.assists}</td>
                      <td className="ow">
                        <span>{ownerOf(l)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {played.length < POS_CODES.length && (
              <p className="st-mono">
                Sin estrenar: {lines.filter((l) => l.minutes <= 0).map((l) => l.code).join(", ")}.
              </p>
            )}
            {estimated > 0 && (
              <p className="st-mono">
                Incluye minutos estimados por la posición preferida en {estimated} {estimated === 1 ? "partido" : "partidos"}.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- Por sistema
/** The system's seven spots on a small pitch (the pizarra's own drawing lives in its bundle). */
function MiniSystem({ id }: { id: string }) {
  const spots = isFormationName(id) ? systemDef(id).spots : [];
  return (
    <svg className="st-sys-pitch" viewBox="0 0 60 84" aria-hidden="true">
      <rect x="1.5" y="1.5" width="57" height="81" rx="3" className="pl" />
      <path d="M1.5 42h57M18 1.5v10h24v-10M18 82.5v-10h24v10" className="pl" />
      {spots.length ? (
        spots.map(([code, u, v], i) => <circle key={code + i} cx={1.5 + (u / 100) * 57} cy={1.5 + (v / 100) * 81} r="3.6" className={code === "POR" ? "gk" : "pl-dot"} style={{ animationDelay: `${0.15 + i * 0.05}s` }} />)
      ) : (
        <text x="30" y="45" className="free">
          libre
        </text>
      )}
    </svg>
  );
}

function PorSistema({ games }: { games: ClubMatch[] }) {
  const { lines, withoutBoard } = useMemo(() => systemRecord(games), [games]);
  // «Mejor sistema»: one clear best points per game (> 0) among the systems played at least twice
  const contenders = lines.filter((l) => l.played >= 2);
  const topPpg = Math.max(0, ...contenders.map((l) => l.ppg));
  const leaders = contenders.filter((l) => l.ppg === topPpg);
  const best: SystemLine | null = topPpg > 0 && leaders.length === 1 ? leaders[0] : null;
  return (
    <section className="st-card" aria-labelledby="st-sys-t">
      <Head kick="Por sistema" title="El récord de cada sistema" id="st-sys-t">
        <p className="st-mono">Los partidos con pizarra oficial, por el sistema con el que salimos. Victoria 3 puntos, empate 1.</p>
      </Head>
      {lines.length ? (
        <ol className="st-sys" aria-label="Sistemas jugados">
          {lines.map((l, i) => (
            <li key={l.id} className={best?.id === l.id ? "best" : undefined} style={{ animationDelay: `${i * 0.06}s` }}>
              <MiniSystem id={l.id} />
              <span className="nm">
                <b>
                  {l.label} · {l.name}
                </b>
                {best?.id === l.id && <span className="st-sys-best">Mejor sistema</span>}
              </span>
              <span className="nums">
                <span>
                  <small>PJ</small>
                  {l.played}
                </span>
                <span>
                  <small>
                    <abbr title="Ganados, empatados y perdidos">G-E-P</abbr>
                  </small>
                  {l.won}-{l.drawn}-{l.lost}
                </span>
                <span>
                  <small>
                    <abbr title="Goles a favor y en contra">GF:GC</abbr>
                  </small>
                  {l.gf}:{l.ga}
                </span>
              </span>
              <span className="ppg">
                <b>{comma(l.ppg)}</b>
                <small>pts/partido</small>
                <span className="tr" aria-hidden="true">
                  <i style={{ width: `${(l.ppg / 3) * 100}%` }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="st-empty">Aún no hay partidos con pizarra oficial</p>
      )}
      {withoutBoard > 0 && <p className="st-mono">{withoutBoard === 1 ? "1 partido sin pizarra oficial no cuenta aquí" : `${withoutBoard} partidos sin pizarra oficial no cuentan aquí`}</p>}
    </section>
  );
}
