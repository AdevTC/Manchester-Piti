import { useContext, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { KitStillContext } from "../../jersey3d/kitStill";
import { boxPercent, chordPath, curvePath, PITCH_BOX, RING_BOX, ringLabel, shirtSize, type NetworkView, type PlacedNode } from "../../../lib/passNetworkLayout";

export interface DrawNode { id: string; name: string; num?: string; sent: number; received: number }
export interface DrawEdge { key: string; from: string; to: string; completed: number; failed: number }

/** A player's shirt: the printed kit still when the page has one (his name and number printed), else the drawn
 *  Vidrio shirt with the dorsal. The rival never wears our kit: always the drawn shape. */
export function NetShirt({ num, size, rival = false, className = "" }: { num?: string; size: number; rival?: boolean; className?: string }) {
  const found = useContext(KitStillContext)("home", num);
  const still = rival ? undefined : found;
  const style = { "--s": `${size}px`, ...(still ? { "--vd-shirt-img": `url("${still.src}")` } : {}) } as CSSProperties;
  return <span className={`vd-shirt${still ? " vd-shirt--img" : ""}${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">{!still?.printed && <b>{num ?? "·"}</b>}</span>;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The network drawn on the pitch (or the ring): curved passes under HTML shirt buttons, so names stay legible on
 *  a phone and every player is a real button. */
export function PassNetworkDrawing({ uid, view, nodes, placed, edges, maxCompleted, node, pair, rival, onPick }: {
  uid: string; view: NetworkView; nodes: readonly DrawNode[]; placed: readonly PlacedNode[]; edges: readonly DrawEdge[]; maxCompleted: number;
  node: string; pair: DrawEdge | undefined; rival: boolean; onPick: (id: string) => void;
}) {
  const keyed = useRef(0);
  const at = new Map(placed.map(p => [p.id, p]));
  const names = new Map(nodes.map(n => [n.id, n.name]));
  const mates = new Set(node ? edges.flatMap(e => e.from === node ? [e.to] : e.to === node ? [e.from] : []) : []);
  const campo = view === "campo";
  const box = campo ? PITCH_BOX : RING_BOX;
  const mk = (kind: string) => `${uid}-mk-${kind}`;
  const drawn = edges.flatMap((e, i) => {
    const a = at.get(e.from), b = at.get(e.to);
    if (!a || !b) return [];
    const cls = pair ? (e === pair ? "is-pair" : "is-dim") : node ? (e.from === node ? "is-out" : "is-in") : "";
    const marker = pair ? (e === pair ? "in" : "base") : node ? (e.from === node ? "out" : "in") : "base";
    return [{ e, a, b, cls, marker, gid: `${uid}-eg-${i}`, d: campo ? curvePath(a, b) : chordPath(a, b), w: r1(1.4 + 6.4 * e.completed / maxCompleted), o: r1(0.45 + 0.55 * e.completed / maxCompleted) }];
  });
  const pick = (id: string) => (event: MouseEvent<HTMLButtonElement>) => { if (event.detail === 0 && Date.now() - keyed.current < 400) return; onPick(id); };
  const key = (id: string) => (event: KeyboardEvent<HTMLButtonElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); keyed.current = Date.now(); onPick(id); } };
  return <div className={`pn-wrap pn-wrap--${view}${campo ? " vd-pitch" : ""}`} role="group" aria-label="Red dirigida de pases completados">
    <svg className="pn-svg" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} aria-hidden="true" focusable="false">
      <defs>
        {(["base", "out", "in"] as const).map(kind => <marker key={kind} id={mk(kind)} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={kind === "base" ? 7 : 9} markerHeight={kind === "base" ? 7 : 9} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path className={`pn-mk-${kind}`} d="M0 0L10 5L0 10z"/></marker>)}
        <radialGradient id={`${uid}-halo`}><stop offset="0" className="pn-halo0"/><stop offset="1" className="pn-halo1"/></radialGradient>
        {drawn.map(g => <linearGradient key={g.e.key} id={g.gid} gradientUnits="userSpaceOnUse" x1={r1(g.a.X)} y1={r1(g.a.Y)} x2={r1(g.b.X)} y2={r1(g.b.Y)}><stop offset="0" className={`pn-gs0${g.cls && g.cls !== "is-dim" ? ` ${g.cls}` : ""}`}/><stop offset="1" className={`pn-gs1${g.cls && g.cls !== "is-dim" ? ` ${g.cls}` : ""}`}/></linearGradient>)}
      </defs>
      {campo ? <g className="vd-pitch__lines">
        <rect x="14" y="14" width="372" height="532" rx="8"/><line x1="14" y1="280" x2="386" y2="280"/><circle cx="200" cy="280" r="46"/>
        <rect x="104" y="14" width="192" height="84"/><rect x="152" y="14" width="96" height="30"/><rect x="104" y="462" width="192" height="84"/><rect x="152" y="516" width="96" height="30"/>
      </g> : <circle className="pn-zone" cx={RING_BOX.cx} cy={RING_BOX.cy} r={RING_BOX.R}/>}
      <g>{drawn.map(g => <path key={g.e.key} d={g.d} pathLength={1} className={`pn-edge${g.cls ? ` ${g.cls}` : ""}`} style={{ stroke: `url(#${g.gid})`, strokeWidth: `${g.w}px`, opacity: g.o, markerEnd: `url(#${mk(g.marker)})` }}><title>{`${names.get(g.e.from)} → ${names.get(g.e.to)}: ${g.e.completed} pases completados${g.e.failed ? `, ${g.e.failed} fallidos` : ""}`}</title></path>)}</g>
      <g>{placed.map(p => { const on = p.id === node || !!pair && (pair.from === p.id || pair.to === p.id); return <circle key={p.id} className={`pn-halo${on ? " is-on" : node && !mates.has(p.id) && p.id !== node ? " is-dim" : ""}`} cx={r1(p.X)} cy={r1(p.Y)} r={r1(p.r * 2.2)} fill={`url(#${uid}-halo)`}/>; })}</g>
    </svg>
    {campo && <span className="pn-attack" aria-hidden="true">Atacamos hacia arriba</span>}
    <div className="pn-nodes">
      {nodes.map(n => {
        const p = at.get(n.id);
        if (!p) return null;
        const { px, py } = boxPercent(view, p), s = shirtSize(p.r), on = n.id === node, mate = mates.has(n.id);
        const lit = on || !!pair && (pair.from === n.id || pair.to === n.id);
        const label = campo ? null : ringLabel(p);
        return <button key={n.id} type="button" className={`pn-nb${lit ? " is-on" : ""}${node && !on && !mate ? " is-dim" : ""}${mate ? " is-mate" : ""}`} style={{ left: `${px}%`, top: `${py}%` }} aria-pressed={on} aria-label={`Resaltar a ${n.name}: ${n.sent} pases dados y ${n.received} recibidos`} onClick={pick(n.id)} onKeyDown={key(n.id)}>
          <NetShirt num={n.num} size={s} rival={rival} className="pn-nb__shirt"/>
          {label ? <span className={`pn-nb__lab pn-nb__lab--${label.anchor}`} style={{ left: `calc(50% + ${label.lx}px)`, top: `calc(50% + ${label.ly}px)` }}>{n.name}</span>
            : <span className="pn-nb__name" style={{ top: `calc(50% + ${r1(s * 0.68 + 2)}px)` }}>{n.name}</span>}
        </button>;
      })}
    </div>
  </div>;
}
