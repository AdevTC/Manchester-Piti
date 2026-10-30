import { useContext, useId, type CSSProperties, type KeyboardEvent } from "react";
import type { WorkspacePerson } from "../../../lib/analysisWorkspace";
import { SHOT_OUTCOME_MANY, SHOT_OUTCOME_ONE, SHOT_OUTCOMES, UNKNOWN_SHOOTER, goalDots, totalShots, type FunnelFigures, type ShooterRow, type ShotCounts, type ShotOutcome, type ShotRow, type ShotTimeline } from "../../../lib/shotOutcomes";
import { KitStillContext } from "../../jersey3d/kitStill";
import { chartClock, chartPercent } from "./format";
import { shotLabel, whoSummary, type ShotPick } from "./shotText";

interface Common { pick: ShotPick; onPick: (pick: ShotPick) => void; them: boolean }

const svgId = (uid: string) => uid.replace(/[^a-zA-Z0-9_-]/g, "");
const press = (run: () => void) => (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); run(); } };

/* ---------- Portería ---------- */

const ZONE_LABELS: { outcome: ShotOutcome; x: number; y: number }[] = [{ outcome: "gol", x: 50, y: 31 }, { outcome: "parado", x: 50, y: 58 }, { outcome: "fuera", x: 13, y: 86 }, { outcome: "bloqueado", x: 84, y: 92 }, { outcome: "madera", x: 87, y: 12 }];
const NET = "M208 94V262M234 94V262M260 94V262M286 94V262M312 94V262M338 94V262M364 94V262M390 94V262M182 118H418M182 142H418M182 166H418M182 190H418M182 214H418M182 238H418M190 70L211.1 94M226 70L240.2 94M262 70L269.3 94M298 70L298.4 94M334 70L327.5 94M370 70L356.6 94M410 70L388.9 94M154 100L182 118M446 100L418 118M154 130L182 142M446 130L418 142M154 160L182 166M446 160L418 166M154 190L182 190M446 190L418 190M154 220L182 214M446 220L418 214M154 250L182 238M446 250L418 238";

export function ShotGoal({ rows, counts, people, rival, pick, onPick, them }: Common & { rows: readonly ShotRow[]; counts: ShotCounts; people: readonly WorkspacePerson[]; rival: string }) {
  const gid = svgId(useId());
  const dots = goalDots(rows);
  const lower = (n: number, outcome: ShotOutcome) => outcome === "madera" ? "a la madera" : (n === 1 ? SHOT_OUTCOME_ONE : SHOT_OUTCOME_MANY)[outcome].toLowerCase();
  return <figure className="gs-goal">
    <div className="gs-goalwrap">
      <svg className="gs-goalsvg" viewBox="0 0 600 340" role="group" aria-label="Cada remate, en la zona de cómo acabó">
        <defs><radialGradient id={`${gid}-flood`} cx="50%" cy="38%" r="62%"><stop offset="0" className="gs-fl0"/><stop offset="1" className="gs-fl1"/></radialGradient></defs>
        <g aria-hidden="true">
          <ellipse fill={`url(#${gid}-flood)`} cx="300" cy="165" rx="290" ry="170"/>
          <rect className="gs-zone" x="18" y="40" width="118" height="236" rx="14"/><rect className="gs-zone" x="464" y="40" width="118" height="236" rx="14"/><rect className="gs-zone" x="160" y="6" width="280" height="50" rx="14"/>
          <ellipse className="gs-shadow" cx="300" cy="284" rx="176" ry="9"/>
          <line className="gs-ground" x1="0" y1="280" x2="600" y2="280"/>
          <path className="gs-net" d={NET}/>
          <path className="gs-back" d="M182 262V94H418V262M154 70L182 94M446 70L418 94M154 280L182 262M446 280L418 262"/>
          <rect className="gs-wall" x="160" y="292" width="280" height="40" rx="10"/>
          <path className="gs-frame" d="M154 280V70H446V280"/>
        </g>
        {dots.map(({ key, row, x, y }) => {
          const on = pick.kind === "shot" && pick.id === row.event.evidenceId;
          const dim = pick.kind === "cat" && pick.cat !== row.outcome || pick.kind === "shot" && !on;
          const choose = () => onPick(on ? { kind: "metric", id: "029" } : { kind: "shot", id: row.event.evidenceId });
          return <g key={key} className={`gs-dot is-${row.outcome}${row.outside ? " is-ring" : ""}${them ? " is-them" : ""}${on ? " is-on" : ""}${dim ? " is-dim" : ""}`} style={{ transform: `translate(${x}px,${y}px)` }} role="button" tabIndex={0} aria-pressed={on} aria-label={shotLabel(row, people, rival)} onClick={choose} onKeyDown={press(choose)}>
            <circle className="gs-dot__hit" r="14"/><circle className="gs-dot__m" r={row.outcome === "gol" ? 10.5 : 8}/>{row.outcome === "gol" && <path className="gs-dot__p" d="M0 -4.4l4.2 3-1.6 4.9h-5.2l-1.6-4.9z"/>}
          </g>;
        })}
      </svg>
      {ZONE_LABELS.filter(z => counts[z.outcome]).map(z => <span key={z.outcome} className="gs-zl" style={{ left: `${z.x}%`, top: `${z.y}%` }} aria-hidden="true"><b>{counts[z.outcome]}</b>{lower(counts[z.outcome], z.outcome)}</span>)}
    </div>
    <div className="gs-cats" role="group" aria-label="Resaltar por resultado">
      {SHOT_OUTCOMES.filter(outcome => counts[outcome]).map(outcome => <button key={outcome} type="button" className="gs-cat" aria-pressed={pick.kind === "cat" && pick.cat === outcome} onClick={() => onPick(pick.kind === "cat" && pick.cat === outcome ? { kind: "metric", id: "029" } : { kind: "cat", cat: outcome })}><i className={`gs-sw gs-sw--${outcome}${them ? " is-them" : ""}`} aria-hidden="true"/>{SHOT_OUTCOME_MANY[outcome]} <b>{counts[outcome]}</b></button>)}
    </div>
    <p className="gs-legendline"><i className="gs-sw gs-sw--fill" aria-hidden="true"/>Punto relleno: dentro del área o sin precisar <i className="gs-sw gs-sw--ring" aria-hidden="true"/>Aro: desde fuera del área</p>
    <figcaption className="gc-note gs-caption">La zona dice cómo acabó cada remate, no por dónde fue: la narración no guarda el punto exacto.</figcaption>
  </figure>;
}

/* ---------- Embudo ---------- */

interface Block { kind: "all" | "parado" | "gol" | "madera" | "fuera" | "bloqueado" | "nd"; n: number; label: string; x: number; w: number; pick?: ShotPick; of?: number }
const r1 = (n: number) => Math.round(n * 10) / 10;
const ribbon = (sx: number, sw: number, x: number, w: number) => `M${r1(sx)} 0C${r1(sx)} 22 ${r1(x)} 22 ${r1(x)} 44L${r1(x + w)} 44C${r1(x + w)} 22 ${r1(sx + sw)} 22 ${r1(sx + sw)} 0Z`;

export function ShotFunnel({ figures, pick, onPick, them }: Common & { figures: FunnelFigures }) {
  const gid = svgId(useId());
  const { total, onTarget, woodwork, off, blocked, unknown, goals, saved } = figures;
  const T = Math.max(1, total), gap = 1.2;
  const parts: Block[] = ([["all", onTarget, "A puerta", { kind: "metric", id: "030" }], ["madera", woodwork, "A la madera", { kind: "funnel", cat: "madera" }], ["fuera", off, "Fuera", { kind: "funnel", cat: "fuera" }], ["bloqueado", blocked, "Bloqueados", { kind: "funnel", cat: "bloqueado" }], ["nd", unknown, "Sin precisar", { kind: "funnel", cat: "nd" }]] as const).filter(p => p[1] > 0).map(([kind, n, label, choice]) => ({ kind, n, label, pick: choice, x: 0, w: 0 }));
  const avail = 100 - gap * Math.max(0, parts.length - 1);
  const rib1: { d: string; cls: string }[] = [];
  let x = 0, src = 0, door: [number, number] = [0, 0];
  for (const p of parts) { p.x = x; p.w = avail * p.n / T; const sw = 100 * p.n / T; rib1.push({ d: ribbon(src, sw, x, p.w), cls: "" }); if (p.label === "A puerta") door = [x, p.w]; src += sw; x += p.w + gap; }
  const kids: Block[] = onTarget > 0 ? ([["gol", goals, them ? "Goles del rival" : "Goles", { kind: "funnel", cat: "gol" }], ["parado", saved, "Parados", { kind: "funnel", cat: "parado" }]] as const).filter(k => k[1] > 0).map(([kind, n, label, choice]) => ({ kind, n, label, pick: choice, x: 0, w: 0, of: onTarget })) : [];
  const rib2: { d: string; cls: string }[] = [];
  { const g2 = kids.length > 1 ? gap : 0, span = Math.max(door[1], 44), av = span - g2; let xx = Math.max(0, Math.min(door[0] + door[1] / 2 - span / 2, 100 - span)), ss = door[0];
    for (const k of kids) { k.x = xx; k.w = av * k.n / onTarget; const sw = door[1] * k.n / onTarget; rib2.push({ d: ribbon(ss, sw, xx, k.w), cls: k.kind === "gol" && !them ? "is-gold" : "" }); xx += k.w + g2; ss += sw; } }
  const same = (a: ShotPick, b?: ShotPick) => !!b && JSON.stringify(a) === JSON.stringify(b);
  const block = (b: Block) => {
    const share = chartPercent(b.n, T);
    return <button key={b.label} type="button" className={`gs-icb gs-icb--${b.kind}${them ? " is-them" : ""}${b.w < 13 ? " is-narrow" : ""}`} style={{ left: `${r1(b.x)}%`, width: `${r1(Math.max(b.w, 3.2))}%` }} aria-pressed={same(pick, b.pick)} aria-label={`${b.label}: ${b.n}, ${share} de los remates${b.of ? ` (de ${b.of} a puerta)` : ""}`} onClick={() => b.pick && onPick(b.pick)}><b>{b.n}</b><span>{b.label}</span><small>{share} de los remates</small></button>;
  };
  const fill = them ? `url(#${gid}-t)` : `url(#${gid}-u)`;
  return <div className="gs-ic" role="group" aria-label="De todos los remates a los goles">
    <div className="gs-ic__row">{block({ kind: "all", n: total, label: "Remates", x: 0, w: 100, pick: { kind: "metric", id: "029" } })}</div>
    <svg className="gs-ic__rib" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={`${gid}-u`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="gs-rg0"/><stop offset="1" className="gs-rg1"/></linearGradient><linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="gs-rg0"/><stop offset="1" className="gs-rgg1"/></linearGradient><linearGradient id={`${gid}-t`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="gs-rgt0"/><stop offset="1" className="gs-rgt1"/></linearGradient></defs>
      {rib1.map(r => <path key={r.d} d={r.d} fill={fill}/>)}
    </svg>
    <div className="gs-ic__row">{parts.map(block)}</div>
    {kids.length > 0 && <><svg className="gs-ic__rib" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">{rib2.map(r => <path key={r.d} d={r.d} fill={r.cls ? `url(#${gid}-g)` : fill}/>)}</svg>
      <div className="gs-ic__row">{kids.map(block)}</div></>}
    <p className="gs-ickey">Remates {total} → a puerta {onTarget} · madera {woodwork} · fuera {off} · bloqueados {blocked}{unknown ? ` · sin precisar ${unknown}` : ""} → goles {goals}{saved ? ` · parados ${saved}` : ""}. Gol por tiro a puerta: {chartPercent(goals, onTarget)}.</p>
  </div>;
}

/* ---------- Minutos ---------- */

export function ShotMinutes({ timeline, people, rival, pick, onPick }: Common & { timeline: ShotTimeline; people: readonly WorkspacePerson[]; rival: string }) {
  const half = 26 + timeline.maxStack * 22, height = half * 2;
  const goals = (rows: readonly ShotRow[]) => totalShots(rows.filter(row => row.outcome === "gol"));
  const line = (rows: readonly ShotRow[]) => { const n = totalShots(rows), g = goals(rows); return `${n} ${n === 1 ? "remate" : "remates"} · ${g} ${g === 1 ? "gol" : "goles"}`; };
  return <div className="gs-tl">
    <p className="gs-tl__lab"><span>Manchester Piti</span><span>{line(timeline.us)}</span></p>
    <div className="gs-tl__plot" style={{ height }} role="group" aria-label="Remates de los dos equipos a lo largo del partido">
      {timeline.bands.map(b => <span key={b.period} className="gs-tl__band" style={{ left: `${b.x}%`, width: `${b.w}%` }} aria-hidden="true"><span className="gs-tl__bandlab">{b.label}</span></span>)}
      <span className="gs-tl__axis" aria-hidden="true"/>
      {timeline.dots.map(d => {
        const on = pick.kind === "shot" && pick.id === d.row.event.evidenceId;
        const top = d.team === "us" ? half - 18 - (d.stack - 1) * 22 : half + 18 + (d.stack - 1) * 22;
        return <button key={d.key} type="button" className={`gs-tld${d.team === "opponent" ? " is-them" : ""}${d.row.outcome === "gol" ? " is-gol" : ""}${d.row.outside ? " is-ring" : ""}${on ? " is-on" : ""}`} style={{ left: `${d.x}%`, top }} aria-pressed={on} aria-label={`${d.team === "opponent" ? rival : "Piti"}: ${shotLabel(d.row, people, rival)}`} onClick={() => onPick(on ? { kind: "metric", id: "029" } : { kind: "shot", id: d.row.event.evidenceId })}/>;
      })}
    </div>
    <p className="gs-tl__lab gs-tl__lab--them"><span>{rival}</span><span>{line(timeline.them)}</span></p>
    <div className="gs-ticks" aria-hidden="true">{timeline.ticks.map((t, i) => <span key={i} style={{ left: `${t.x}%` }}>{chartClock(t.second)}</span>)}</div>
    <p className="gc-legend"><span><i className="gc-sw gs-sw gs-sw--gol" aria-hidden="true"/>Gol nuestro</span><span><i className="gc-sw gs-sw gs-sw--gol is-them" aria-hidden="true"/>Gol del rival</span><span><i className="gc-sw gs-sw gs-sw--fill" aria-hidden="true"/>Dentro del área o sin precisar</span><span><i className="gc-sw gs-sw gs-sw--ring" aria-hidden="true"/>Desde fuera del área</span></p>
    {timeline.skipped > 0 && <p className="gc-note">{timeline.skipped} {timeline.skipped === 1 ? "remate no se dibuja" : "remates no se dibujan"}: sin tiempo fiable dentro de su parte, sin límites de parte registrados o con un intervalo de más de diez minutos. Siguen incluidos en los totales.</p>}
  </div>;
}

/* ---------- Quién ---------- */

function Shirt({ number }: { number?: number | string | null }) {
  const num = number == null ? undefined : String(number);
  const still = useContext(KitStillContext)("home", num);
  if (still) return <img className="gs-who__still" src={still.src} alt="" width={540} height={600}/>;
  return <span className="vd-shirt gs-who__shirt" style={{ "--s": "30px" } as CSSProperties} aria-hidden="true"><b>{num ?? "·"}</b></span>;
}
const SEG_ORDER: readonly ShotOutcome[] = ["gol", "parado", "madera", "bloqueado", "fuera", "nd"];

export function ShotWho({ rows, pick, onPick, them }: Common & { rows: readonly ShooterRow[] }) {
  const max = Math.max(1, ...rows.map(row => row.total));
  return <>
    <ol className="gs-who" aria-label="Remates por jugador">{rows.map(row => { const on = pick.kind === "who" && pick.key === row.key; return <li key={row.key}>
      <button type="button" className="gs-whorow" aria-pressed={on} aria-label={`${row.name}: ${row.total} ${row.total === 1 ? "remate" : "remates"}. Ver jugadas`} onClick={() => onPick(on ? { kind: "metric", id: "029" } : { kind: "who", key: row.key })}>
        <span className="gs-who__name">{row.key === UNKNOWN_SHOOTER ? <span className="vd-shirt gs-who__shirt" style={{ "--s": "30px" } as CSSProperties} aria-hidden="true"><b>·</b></span> : <Shirt number={row.number}/>}<span className={them ? "gs-who__rival" : undefined}>{row.name}</span></span>
        <span className="gs-who__bar" aria-hidden="true">{SEG_ORDER.filter(k => row.counts[k]).map(k => <i key={k} className={`gs-wseg gs-wseg--${k}`} style={{ width: `${r1(row.counts[k] / max * 100)}%` }}/>)}</span>
        <span className="gs-who__n">{row.total}</span>
        <span className="gs-who__sub">{whoSummary(row.counts, totalShots(row.rows.filter(shot => shot.onTarget || shot.outcome === "gol")))}</span>
      </button></li>; })}</ol>
    <p className="gc-legend"><span><i className="gc-sw gs-wsw gs-wseg--gol" aria-hidden="true"/>Gol</span><span><i className="gc-sw gs-wsw gs-wseg--parado" aria-hidden="true"/>Parado</span><span><i className="gc-sw gs-wsw gs-wseg--madera" aria-hidden="true"/>A la madera</span><span><i className="gc-sw gs-wsw gs-wseg--bloqueado" aria-hidden="true"/>Bloqueado</span><span><i className="gc-sw gs-wsw gs-wseg--fuera" aria-hidden="true"/>Fuera</span>{rows.some(row => row.counts.nd) && <span><i className="gc-sw gs-wsw gs-wseg--nd" aria-hidden="true"/>Sin precisar</span>}</p>
  </>;
}
