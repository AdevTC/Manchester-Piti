// Charts of the Celeste Estadísticas page: results columns, the pass constellation, the goal clock,
// the radar, ranking bars and the per-player jornada strip. Plain SVG/HTML, theme tokens only.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ClubMatch } from "../../lib/clubData";
import { formatDate } from "../../lib/clubData";
import { competitionRanks, medalFor, type PlayerAnalysis } from "../../lib/clubAnalytics";
import { constellation, goalClock, RADAR_AXES, radarPoints, type HeatCell, type StarLink } from "../../lib/statsView";

const letter = (m: ClubMatch) => (m.goalsFor! > m.goalsAgainst! ? "V" : m.goalsFor === m.goalsAgainst ? "E" : "D");
const resultWord = { V: "victoria", E: "empate", D: "derrota" } as const;
const shortDate = (m: ClubMatch) => formatDate(m.date).replace(/^[^,]*,\s*/, "").replace(/( de)? \d{4}$/, "");

/** Last games as paired columns (ours up, theirs down), each one a link to its match. */
export function ResultsChart({ games }: { games: ClubMatch[] }) {
  const last = games.slice(-12);
  const max = Math.max(1, ...last.flatMap((m) => [m.goalsFor!, m.goalsAgainst!]));
  return (
    <div className="st-res" style={{ gridTemplateColumns: `repeat(${Math.max(last.length, 6)}, minmax(0, 1fr))` }}>
      {last.map((m, i) => {
        const l = letter(m);
        return (
          <Link key={m.id} to="/matches/$matchId" params={{ matchId: m.id }} className="col" style={{ animationDelay: `${i * 0.06}s` }} aria-label={`${m.goalsFor} a ${m.goalsAgainst} contra ${m.rival ?? "rival"}, ${resultWord[l]}, ${formatDate(m.date)}`}>
            <span className="up">
              <b>{m.goalsFor}</b>
              <i style={{ height: `${(m.goalsFor! / max) * 100}%` }} />
            </span>
            <span className="dn">
              <i style={{ height: `${(m.goalsAgainst! / max) * 100}%` }} />
              <b>{m.goalsAgainst}</b>
            </span>
            <span className={`lt ${l}`}>{l}</span>
            <small>{shortDate(m)}</small>
          </Link>
        );
      })}
    </div>
  );
}

/** The squad as a star map: stars by position and G+A, assist lines drawn in, tap a star to follow it. */
export function Constellation({ rows, links, nameOf, focus }: { rows: PlayerAnalysis[]; links: StarLink[]; nameOf: (p: PlayerAnalysis) => string; focus?: string }) {
  const map = useMemo(() => constellation(rows, links), [rows, links]);
  const [picked, setPicked] = useState<string | null>(focus ?? null);
  const [run, setRun] = useState(0);
  if (!map.nodes.length) return <p className="st-empty">Aún no hay goles con asistencia en este período.</p>;
  const pos = new Map(map.nodes.map((n) => [n.id, n]));
  const maxN = Math.max(1, ...map.links.map((l) => l.n));
  const on = (l: StarLink) => !picked || l.from === picked || l.to === picked;
  const sel = picked ? map.nodes.find((n) => n.id === picked) : undefined;
  const names = new Map(rows.map((p) => [p.id, nameOf(p)]));
  const gives = picked ? map.links.filter((l) => l.from === picked) : [];
  const gets = picked ? map.links.filter((l) => l.to === picked) : [];
  return (
    <div className="st-sky">
      <div className="st-sky-map" key={run}>
        <svg viewBox="0 0 100 110" preserveAspectRatio="none" aria-hidden="true">
          <rect x="3" y="3" width="94" height="104" rx="3" className="pitch" />
          <path d="M3 55h94M35 3v12h30V3M35 107V95h30v12" className="pitch" />
          <circle cx="50" cy="55" r="9" className="pitch" />
          {map.links.map((l, i) => {
            const a = pos.get(l.from)!, b = pos.get(l.to)!;
            const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
            return <path key={l.from + l.to} d={`M${a.x} ${a.y}Q${mx} ${my} ${b.x} ${b.y}`} pathLength={1} className={`ln${on(l) ? (picked ? " hot" : "") : " dim"}`} style={{ strokeWidth: 0.35 + (l.n / maxN) * 0.9, animationDelay: `${0.3 + i * 0.14}s` }} />;
          })}
        </svg>
        {map.nodes.map((n, i) => {
          const p = rows.find((r) => r.id === n.id)!;
          return (
            <button
              key={n.id}
              type="button"
              className={`st-star${picked === n.id ? " on" : ""}${picked && picked !== n.id && !map.links.some((l) => (l.from === picked && l.to === n.id) || (l.to === picked && l.from === n.id)) ? " dim" : ""}`}
              style={{ left: `${n.x}%`, top: `${(n.y / 110) * 100}%`, ["--s" as string]: `${n.r * 4}px`, animationDelay: `${i * 0.05}s` }}
              aria-pressed={picked === n.id}
              aria-label={`${n.name}: ${p.goals} goles y ${p.assists} asistencias`}
              onClick={() => setPicked(picked === n.id ? null : n.id)}
            >
              <i />
              <span>{n.name}</span>
            </button>
          );
        })}
      </div>
      <div className="st-sky-ft">
        {sel ? (
          <div className="st-sky-card">
            <b>{sel.name}</b>
            <span className="st-mono">
              {rows.find((r) => r.id === sel.id)!.goals} G · {rows.find((r) => r.id === sel.id)!.assists} A
            </span>
            <p>
              {gets.length ? `Le asisten: ${gets.map((l) => `${names.get(l.from)} (${l.n})`).join(", ")}.` : "Nadie le ha asistido aún."} {gives.length ? `Asiste a: ${gives.map((l) => `${names.get(l.to)} (${l.n})`).join(", ")}.` : ""}
            </p>
            <Link to="/jugadores/$playerId" params={{ playerId: sel.id }}>
              Su ficha →
            </Link>
          </div>
        ) : (
          <p className="st-mono">Toca una estrella para seguir sus pases. Línea más gruesa, más goles juntos.</p>
        )}
        <button type="button" className="hm-ghostbtn st-sm" onClick={() => (picked ? setPicked(null) : setRun(run + 1))}>
          {picked ? "Ver todas" : "Repetir"}
        </button>
      </div>
    </div>
  );
}

const arc = (c: number, r0: number, r1: number, a0: number, a1: number) => {
  const p = (r: number, a: number) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
  return `M${p(r0, a0)}L${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
};
/** "El reloj de goles": when we score and concede, by 5′ slice. Ours solid, theirs hatched. */
export function GoalClock({ games, playerId, compact = false }: { games: ClubMatch[]; playerId?: string; compact?: boolean }) {
  const clock = useMemo(() => goalClock(games, playerId), [games, playerId]);
  const [show, setShow] = useState<"both" | "us" | "them">("both");
  const [slice, setSlice] = useState<number | null>(null);
  const C = 120, R0 = 34, R1 = 98;
  const n = clock.slices.length;
  const max = Math.max(1, ...clock.slices.flatMap((s) => [s.us, s.them]));
  const total = clock.slices.reduce((s, x) => s + x.us + x.them, 0);
  if (!total) return <p className="st-empty">{playerId ? "Aún sin goles con minuto." : "Aún no hay goles con minuto registrado."}</p>;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const half = clock.duration / 2;
  const cur = slice === null ? null : clock.slices[slice];
  const caption = playerId
    ? clock.peakUs && `Su tramo: entre el ${clock.peakUs.from}′ y el ${clock.peakUs.to}′`
    : [clock.peakUs && `Marcamos más entre el ${clock.peakUs.from}′ y el ${clock.peakUs.to}′`, clock.peakThem && `encajamos más entre el ${clock.peakThem.from}′ y el ${clock.peakThem.to}′`].filter(Boolean).join("; ");
  return (
    <div className={`st-clock${compact ? " compact" : ""}`}>
      {!playerId && (
        <div className="st-seg sm" role="group" aria-label="Qué goles ver">
          {(
            [
              ["both", "Ambos"],
              ["us", "A favor"],
              ["them", "En contra"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="st-clock-dial">
        <svg viewBox="0 0 240 240" role="img" aria-label={caption || "Reloj de goles"}>
          <defs>
            <pattern id="st-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" className="hb" />
              <path d="M0 0v5" className="hl" />
            </pattern>
          </defs>
          <circle cx={C} cy={C} r={R1 + 6} className="rim" />
          {clock.slices.map((s, i) => {
            const a0 = ang(i) + 0.03, a1 = ang(i + 1) - 0.03, mid = (a0 + a1) / 2;
            const us = playerId || show !== "them" ? s.us : 0, them = !playerId && show !== "us" ? s.them : 0;
            return (
              <g key={s.from} className={slice === i ? "pick" : undefined} style={{ animationDelay: `${0.2 + i * 0.07}s` }}>
                {us > 0 && <path d={arc(C, R0, R0 + ((R1 - R0) * us) / max, a0, playerId || show === "us" ? a1 : mid - 0.01)} className="us" />}
                {them > 0 && <path d={arc(C, R0, R0 + ((R1 - R0) * them) / max, show === "them" ? a0 : mid + 0.01, a1)} className="them" />}
              </g>
            );
          })}
          {Array.from({ length: n + 1 }, (_, i) => i)
            .filter((i) => i % 2 === 0 && i < n)
            .map((i) => {
              const a = ang(i);
              return (
                <text key={i} x={C + (R1 + 15) * Math.cos(a)} y={C + (R1 + 15) * Math.sin(a) + 3} className="tick">
                  {i * 5}′
                </text>
              );
            })}
          <path d={`M${C} ${C - R0 + 2}V${C - R1 - 4}`} transform={`rotate(${(half / clock.duration) * 360} ${C} ${C})`} className="half" />
          <circle cx={C} cy={C} r={R0 - 4} className="hub" />
          <text x={C} y={C - 2} className="big">
            {playerId ? clock.slices.reduce((s, x) => s + x.us, 0) : clock.slices.reduce((s, x) => s + x.us, 0) + "–" + clock.slices.reduce((s, x) => s + x.them, 0)}
          </text>
          <text x={C} y={C + 13} className="sm">
            {playerId ? "goles" : "por minuto"}
          </text>
        </svg>
      </div>
      {!compact && (
        <div className="st-clock-slices" role="group" aria-label="Ver un tramo">
          {clock.slices.map((s, i) => (
            <button key={s.from} type="button" aria-pressed={slice === i} onClick={() => setSlice(slice === i ? null : i)}>
              {s.from}′
            </button>
          ))}
        </div>
      )}
      <p className="st-cap">
        {cur ? (playerId ? `Del ${cur.from}′ al ${cur.to}′: ${cur.us} ${cur.us === 1 ? "gol" : "goles"}.` : `Del ${cur.from}′ al ${cur.to}′: ${cur.us} a favor y ${cur.them} en contra.`) : caption}
        {clock.unknown > 0 && <small> · {clock.unknown} sin minuto</small>}
      </p>
      {!playerId && (
        <p className="st-legend">
          <span>
            <i className="us" /> a favor
          </span>
          <span>
            <i className="them" /> en contra
          </span>
          <span>
            <i className="half" /> descanso
          </span>
        </p>
      )}
    </div>
  );
}

/** Six-axis radar; `a` in sky, `b` (another player or the squad average) in gold, dashed. */
export function Radar({ a, b, aLabel, bLabel }: { a: number[]; b?: number[]; aLabel: string; bLabel?: string }) {
  const C = 120, R = 82;
  const axis = (i: number, r: number) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / RADAR_AXES.length;
    return [C + Math.cos(t) * r, C + Math.sin(t) * r] as const;
  };
  return (
    <figure className="st-radar">
      <svg viewBox="0 0 240 240" role="img" aria-label={`${aLabel}${bLabel ? ` frente a ${bLabel}` : ""}: ${RADAR_AXES.map((x, i) => `${x} ${Math.round(a[i] * 100)}${b ? ` contra ${Math.round(b[i] * 100)}` : ""}`).join(", ")}`}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <polygon key={k} points={radarPoints(RADAR_AXES.map(() => k), C, R)} className="grid" />
        ))}
        {RADAR_AXES.map((label, i) => {
          const [x, y] = axis(i, R);
          const [lx, ly] = axis(i, R + 20);
          return (
            <g key={label}>
              <line x1={C} y1={C} x2={x} y2={y} className="grid" />
              <text x={lx} y={ly + 3} className="ax">
                {label}
              </text>
            </g>
          );
        })}
        {b && <polygon key={"b" + b.join()} points={radarPoints(b, C, R)} className="b" />}
        <polygon key={"a" + a.join()} points={radarPoints(a, C, R)} className="a" />
      </svg>
      <figcaption>
        <span>
          <i className="a" /> {aLabel}
        </span>
        {bLabel && (
          <span>
            <i className="b" /> {bLabel}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** Ranking bars with shared ranks and goal medals; zero values left out. */
export function Bars({ rows, value, unit, nameOf, medals = false, empty = "Sin registros para esta selección." }: { rows: PlayerAnalysis[]; value: (p: PlayerAnalysis) => number; unit: string; nameOf: (p: PlayerAnalysis) => string; medals?: boolean; empty?: string }) {
  const items = rows.filter((p) => value(p) > 0).sort((a, b) => value(b) - value(a) || nameOf(a).localeCompare(nameOf(b)));
  if (!items.length) return <p className="st-empty">{empty}</p>;
  const ranks = competitionRanks(items, value);
  const max = value(items[0]);
  return (
    <ol className="st-bars">
      {items.map((p, i) => {
        const medal = medals ? medalFor(ranks.get(p.id), p.goals) : null;
        return (
          <li key={p.id} style={{ animationDelay: `${i * 0.04}s` }}>
            <span className={`rk${medal ? " " + medal : ""}`}>{ranks.get(p.id)}</span>
            <Link to="/jugadores/$playerId" params={{ playerId: p.id }} className="nm">
              {nameOf(p)}
            </Link>
            <span className="tr">
              <i style={{ width: `${(value(p) / max) * 100}%` }} />
            </span>
            <b>
              {value(p)}
              <small> {unit}</small>
            </b>
          </li>
        );
      })}
    </ol>
  );
}

/** One cell per game: minutes as intensity, a dot per goal. */
export function HeatStrip({ cells, label }: { cells: HeatCell[]; label: string }) {
  return (
    <span className="st-heat" role="img" aria-label={`${label}: ${cells.filter((c) => c.played).length} de ${cells.length} partidos jugados`}>
      {cells.map((c) => (
        <i key={c.matchId} className={c.played ? undefined : "no"} style={{ ["--l" as string]: c.level }}>
          {c.goals > 0 && <b>{c.goals > 1 ? c.goals : ""}</b>}
        </i>
      ))}
    </span>
  );
}
