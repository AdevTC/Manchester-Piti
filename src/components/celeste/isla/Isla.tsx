// The island's look, without data: the bug, the rótulo, the segunda pantalla and the three devices (phone row,
// tablet bar, desktop picture-in-picture), drawn from an IslaVista (lib/derived/island). LiveIsland feeds it the
// live match; the dev harness feeds it mock matches. Links come in through `Link` so it needs no router.
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { IslaAnswer, IslaVista, RotuloTone } from "../../../lib/derived/island";
import { nearestCorner, nextCorner, nextSize, shownSize, sizeLabel, type PipPrefs } from "./pip";
import { skyAt, stripStyle } from "./sky";
import "../../../styles/isla.css";

export type IslaDevice = "movil" | "tablet" | "escritorio";
/** Where a link goes: the match page, its summary, its vote (the vestuario tab), la mesa. */
export type IslaLinkTo = "partido" | "resumen" | "votar" | "mesa";
export interface IslaLinkProps {
  to: IslaLinkTo;
  matchId: string;
  className?: string;
  children: ReactNode;
}

export interface IslaProps {
  vista: IslaVista;
  device: IslaDevice;
  /** The moment unfolding (its id: replays the number and the cortinilla per play); null at rest. */
  momentKey: string | null;
  /** Prefers reduced motion: no cortinilla, no widening, and the bug doesn't fly to the match page. */
  reduced: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  hidden: boolean;
  onHide: () => void;
  onShow: () => void;
  /** «Quitar» says what it does («Ocultar el aviso de votar al MVP» for the vote: it doesn't come back). */
  hideLabel?: string;
  pip: PipPrefs;
  onPip: (p: PipPrefs) => void;
  /** «¿Vas hoy?»: the member's answer and how to change it. */
  mine?: IslaAnswer | null;
  onAnswer?: (a: IslaAnswer) => void;
  Link: ComponentType<IslaLinkProps>;
  /** The connection chip (SyncChip), under the bug. */
  chip?: ReactNode;
}

const IC = {
  expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />,
  shrink: <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  arrow: <path d="M7 17L17 7M9 7h8v8" />,
};
const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const CornerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <rect x="12" y="12" width="7" height="7" rx="1.5" fill="currentColor" />
  </svg>
);
const toneCls = (t: RotuloTone) => (t ? ` ${t}` : "");
/** The bug's name in the View Transition: it lands on the match page's scoreboard (.isla-destino). */
const VT = "isla-marcador";

/** The cortinilla: shown 0.9 s for each new moment that has one (never with reduced motion). */
function useWipe(key: string | null, kind: IslaVista["wipe"], reduced: boolean): IslaVista["wipe"] {
  const [on, setOn] = useState<{ key: string | null; kind: IslaVista["wipe"] }>({ key: null, kind: "" });
  if (key && kind && !reduced && on.key !== key) setOn({ key, kind });
  useEffect(() => {
    if (!on.key) return;
    const t = window.setTimeout(() => setOn((s) => (s.key === on.key ? { key: s.key, kind: "" } : s)), 950);
    return () => window.clearTimeout(t);
  }, [on.key]);
  return on.key === key ? on.kind : "";
}

function BugInside({ v, momentKey, wipe, rotulo }: { v: IslaVista; momentKey: string | null; wipe: IslaVista["wipe"]; rotulo: boolean }) {
  const sky = stripStyle(skyAt(v.at));
  return (
    <>
      <span className="is-row">
        <img className="is-cr" src="/crest-128.webp" alt="" width={36} height={36} />
        <span className="is-t">PITI</span>
        {v.pre ? (
          <span className="is-vs">vs</span>
        ) : (
          <span className="is-sc" aria-hidden="true">
            <b className={`is-n${v.changed === "h" && momentKey ? " gold" : ""}`} key={`h${v.changed === "h" ? momentKey : ""}`}>
              {v.gf}
            </b>
            <i />
            <b className={`is-n${v.changed === "a" && momentKey ? " flip" : ""}`} key={`a${v.changed === "a" ? momentKey : ""}`}>
              {v.ga}
            </b>
          </span>
        )}
        <span className="is-t">{v.ini}</span>
        <span className={`is-clk${v.off ? " off" : ""}`}>{v.clock}</span>
        {v.live && <span className="is-dot" aria-hidden="true" />}
      </span>
      <span className="is-strip" style={sky} aria-hidden="true" />
      {rotulo && v.unfold && (
        <span className={`is-x${toneCls(v.rotulo.tone)}${wipe ? " w" : ""}`} key={momentKey ?? ""}>
          <b>{v.rotulo.m}</b>
          <span>{v.rotulo.t}</span>
        </span>
      )}
      {wipe && (
        <span className={`is-wipe${wipe === "rv" ? " rv" : ""}`} key={`w${momentKey}`} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </>
  );
}

function Still({ v }: { v: IslaVista }) {
  const s = skyAt(v.at);
  const style = { "--st": s.top, "--sm": s.mid, "--sh": s.hor, "--fl": s.floodlights, "--sg": s.sunlight.toFixed(2) } as CSSProperties;
  return (
    <div className="is-still" style={style} aria-hidden="true">
      <span className="is-st-sun" />
      <span className="is-st-sil" />
      <span className="is-st-fl l" />
      <span className="is-st-fl r" />
      <span className="is-st-pitch" />
      <span className="is-st-k">{v.kicker}</span>
      <span className="is-st-plate">
        <b>PITI</b>
        <em>{v.pre ? "vs" : `${v.gf}–${v.ga}`}</em>
        <b>{v.ini}</b>
      </span>
    </div>
  );
}

const ANSWERS: { a: IslaAnswer; label: string }[] = [
  { a: "yes", label: "Voy" },
  { a: "maybe", label: "Duda" },
  { a: "no", label: "No voy" },
];

function Panel({ v, Link, mine, onAnswer, still }: { v: IslaVista; Link: IslaProps["Link"]; mine?: IslaAnswer | null; onAnswer?: (a: IslaAnswer) => void; still: boolean }) {
  return (
    <>
      {still && <Still v={v} />}
      <div className={`is-rot${toneCls(v.rotulo.tone)}`}>
        <span className="m">{v.rotulo.m}</span>
        <span className="t">
          <b>{v.rotulo.t}</b>
          {v.rotulo.s && <small>{v.rotulo.s}</small>}
        </span>
      </div>
      {v.hasPulse && (
        <div className="is-pulse" aria-hidden="true">
          <span className="is-pz" />
          <span className="is-pulse-in">
            {v.pulse.map((p, i) => (
              <i key={i} className={`is-pb ${p.ours ? "up" : "dn"}${p.goal ? " g" : ""}`} style={{ left: `${p.pct.toFixed(1)}%` }} />
            ))}
          </span>
        </div>
      )}
      {v.seg && onAnswer && (
        <div className="is-seg" role="group" aria-label="¿Vas hoy?">
          {ANSWERS.map(({ a, label }) => (
            <button key={a} type="button" className="is-b" aria-pressed={mine === a} onClick={() => onAnswer(a)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="is-acts">
        {v.act && (
          <Link to={v.act.kind} matchId={v.matchId} className="is-btn pri">
            {v.act.label}
          </Link>
        )}
        <Link to="partido" matchId={v.matchId} className="is-btn">
          Ver el partido <Svg size={16}>{IC.arrow}</Svg>
        </Link>
      </div>
    </>
  );
}

/** The phone's row follows the header up as it scrolls away, then stays under the safe area. */
function useScrollVar(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    let frame = 0;
    const set = () => {
      frame = 0;
      root.style.setProperty("--isla-scroll", `${Math.min(200, Math.max(0, window.scrollY))}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(set);
    };
    set();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--isla-scroll");
    };
  }, [on]);
}

export function Isla(props: IslaProps) {
  const { vista: v, device, momentKey, reduced, open, onOpen, hidden, onHide, onShow, hideLabel = "Quitar el marcador", mine, onAnswer, Link, chip } = props;
  const wipe = useWipe(momentKey, v.wipe, reduced);
  useScrollVar(device === "movil");
  const vt: CSSProperties | undefined = reduced ? undefined : { viewTransitionName: VT };
  const sky = stripStyle(skyAt(v.at));
  const bugCls = `is-bug${v.off ? " off" : ""}${v.changed === "h" && momentKey ? " gold" : ""}${v.unfold ? " x" : ""}`;
  const label = `${v.aria}. ${open ? "Cerrar" : "Abrir"} la segunda pantalla`;

  if (device === "movil")
    return (
      <div className={`is-r is-movil is-${v.estado}`} data-estado={v.estado}>
        <div className="is-mw">
          {hidden ? (
            <button type="button" className="is-tab" onClick={onShow} aria-label="Mostrar el marcador">
              <i style={sky} />
            </button>
          ) : (
            <button type="button" className={bugCls} style={vt} onClick={() => onOpen(!open)} aria-expanded={open} aria-label={label}>
              <BugInside v={v} momentKey={momentKey} wipe={wipe} rotulo />
            </button>
          )}
          {open && !hidden && (
            <div className="is-panel is-pm" role="dialog" aria-label="Segunda pantalla">
              <Panel v={v} Link={Link} mine={mine} onAnswer={onAnswer} still />
              <button type="button" className="is-hide" onClick={onHide}>
                {hideLabel === "Quitar el marcador" ? "Ocultar el marcador" : hideLabel}
              </button>
            </div>
          )}
        </div>
        {!hidden && chip && <div className="is-chip">{chip}</div>}
      </div>
    );

  if (device === "tablet")
    return (
      <div className={`is-r is-tablet is-${v.estado}`} data-estado={v.estado}>
        {!hidden && chip && <div className="is-chip">{chip}</div>}
        <div className="is-tw">
          {open && !hidden && (
            <div className="is-panel is-pt" role="dialog" aria-label="Segunda pantalla">
              <div>
                <Still v={v} />
              </div>
              <div className="is-ptc">
                <Panel v={v} Link={Link} mine={mine} onAnswer={onAnswer} still={false} />
              </div>
            </div>
          )}
          {hidden ? (
            <button type="button" className="is-tab tb" onClick={onShow} aria-label="Mostrar el marcador">
              <i style={sky} />
            </button>
          ) : (
            <div className="is-tbar">
              <button type="button" className={bugCls} style={vt} onClick={() => onOpen(!open)} aria-label={label}>
                <BugInside v={v} momentKey={momentKey} wipe={wipe} rotulo={false} />
              </button>
              <span className={`is-tlast${v.rotulo.tone === "gold" ? " gold" : ""}${v.unfold ? " x" : ""}`} key={momentKey ?? "rest"}>
                <b>{v.rotulo.m}</b>
                <span>{v.rotulo.t}</span>
              </span>
              <button type="button" className="is-tb" onClick={() => onOpen(!open)} aria-expanded={open}>
                {open ? "Cerrar" : "Abrir"}
              </button>
              <button type="button" className="is-ic" onClick={onHide} aria-label={hideLabel}>
                <Svg>{IC.close}</Svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );

  return <Pip {...props} wipe={wipe} vt={vt} bugCls={bugCls} sky={sky} />;
}

function Pip({ vista: v, momentKey, hidden, onHide, onShow, hideLabel = "Quitar el marcador", pip, onPip, mine, onAnswer, Link, chip, wipe, vt, bugCls, sky }: IslaProps & { wipe: IslaVista["wipe"]; vt: CSSProperties | undefined; bugCls: string; sky: CSSProperties }) {
  const arena = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; w: number; h: number; cx?: number; cy?: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const size = shownSize(pip.size, v.unfold);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      const el = box.current;
      if (!d || !el) return;
      const x = d.ox + e.clientX - d.sx;
      const y = d.oy + e.clientY - d.sy;
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, right: "auto", bottom: "auto" });
      d.cx = x + d.w / 2;
      d.cy = y + d.h / 2;
    };
    const up = () => {
      const d = drag.current;
      const el = box.current;
      const a = arena.current;
      drag.current = null;
      setDragging(false);
      if (el) Object.assign(el.style, { left: "", top: "", right: "", bottom: "" });
      if (d && d.cx !== undefined && d.cy !== undefined && a) onPip({ ...pip, corner: nearestCorner(d.cx, d.cy, a.clientWidth, a.clientHeight) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, onPip, pip]);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (e.button !== 0 || target.closest("button,a")) return;
    const el = box.current;
    const a = arena.current;
    if (!el || !a) return;
    const r = el.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left - ar.left, oy: r.top - ar.top, w: r.width, h: r.height };
    setDragging(true);
  };

  return (
    <div className={`is-r is-escritorio is-${v.estado}`} data-estado={v.estado} ref={arena}>
      {hidden ? (
        <button type="button" className={`is-show c-${pip.corner}`} onClick={onShow}>
          <i style={sky} />
          Mostrar el marcador
        </button>
      ) : (
        <div className={`is-pip c-${pip.corner} s-${size}${dragging ? " drag" : ""}`} ref={box} onPointerDown={down} role="region" aria-label="Marcador flotante: se puede arrastrar a otra esquina">
          <div className="is-ph">
            <span className="is-grip" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div className={`${bugCls} in`} style={vt} role="img" aria-label={v.aria}>
              <BugInside v={v} momentKey={momentKey} wipe={wipe} rotulo={false} />
            </div>
            <span className="is-pb2">
              <button type="button" className="is-ic" onClick={() => onPip({ ...pip, corner: nextCorner(pip.corner) })} aria-label="Llevar a la siguiente esquina">
                <CornerIcon />
              </button>
              <button type="button" className="is-ic" onClick={() => onPip({ ...pip, size: nextSize(pip.size) })} aria-label={sizeLabel(pip.size)}>
                <Svg>{pip.size === "grande" ? IC.shrink : IC.expand}</Svg>
              </button>
              <button type="button" className="is-ic" onClick={onHide} aria-label={hideLabel}>
                <Svg>{IC.close}</Svg>
              </button>
            </span>
          </div>
          {size !== "bug" && (
            <div className="is-pbody">
              <Panel v={v} Link={Link} mine={mine} onAnswer={onAnswer} still={size === "grande"} />
            </div>
          )}
          {chip && <div className="is-chip">{chip}</div>}
        </div>
      )}
    </div>
  );
}
