// The stadium: stands with camera flashes, masts and sweeping beams, the TV-camera pitch with the system
// mowed into the grass, the LED boards, the plan painted on the turf (presión, línea defensiva), the
// química as light, the slots and the cromos; above it, the system pill and the química scoreboard.
import { useEffect, useRef, type RefObject } from "react";
import { FLASHES, pitchArt, type CamName } from "./geometry";
import { Icon } from "./icons";
import { PitchCromo } from "./Cromos";
import { FxLayer } from "./Overlays";
import { vars, type Hud, type PitchView, type PlanLayer } from "./view";
import type { CmpMark } from "./compare";

function Turf({ cam }: { cam: CamName }) {
  const a = pitchArt(cam);
  return (
    <svg className="tf-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path className="apr" d={a.apron} />
      {a.stripes.map((d, i) => (
        <path key={"s" + i} className={"s" + (i % 2)} d={d} />
      ))}
      {a.pools.map((d, i) => (
        <path key={"p" + i} className={"pl pl" + i} d={d} />
      ))}
      <path className="rim" d={a.rim} />
      <g className="lns">
        {a.lines.map((d, i) => (
          <path key={"l" + i} className="ln" pathLength={1} style={vars({ "--i": i })} d={d} />
        ))}
        {a.spots.map((d, i) => (
          <path key={"sp" + i} className="sp" d={d} />
        ))}
      </g>
      {a.goals.map((d, i) => (
        <path key={"g" + i} className="gl" d={d} />
      ))}
      <path className="gd" d={a.dots} />
    </svg>
  );
}

export interface StageProps {
  cam: CamName;
  view: PitchView;
  plan: PlanLayer;
  hud: Hud;
  wmY: string;
  sysk: number;
  ro: boolean;
  editing: boolean;
  showGal: boolean;
  kb: number | null;
  selId: string | null;
  celeSub: string;
  rw: string;
  fxk: number;
  pulse: string;
  /** Comparar: who would come in (dashed gold) and go out (red), on the pitch. */
  cmp: CmpMark[];
  frameRef: RefObject<HTMLDivElement | null>;
  swpRef: RefObject<SVGPathElement | null>;
  onCard: (id: string, el: HTMLElement) => void;
  onSlot: (i: number) => void;
  onLine: () => void;
  onSys: (d: 1 | -1) => void;
  onSysPick: () => void;
  onQuimica: () => void;
}

export function Stage({ frameRef, swpRef, ...p }: StageProps) {
  const { view, plan, hud } = p;
  const stage = useRef<HTMLElement>(null);
  // Loops (and anything heavy) pause while the stadium is offscreen.
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      if (e.isIntersecting) e.target.removeAttribute("data-paused");
      else e.target.setAttribute("data-paused", "");
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const dlhOn = plan.dlOn && p.editing && !p.ro;
  const lineTxt = "LÍNEA " + plan.defLine.toUpperCase();
  return (
    <section className="stage" aria-label={"El campo: " + hud.pitchAria} ref={stage}>
      <div className="sky" aria-hidden="true">
        <div className="crowd">
          {FLASHES.map((f, k) => (
            <i key={k} style={vars({ "--x": f.x, "--y": f.y, "--d": f.d })} />
          ))}
        </div>
        <span className="beam l" />
        <span className="beam r" />
        <span className="mast l">
          <i />
        </span>
        <span className="mast r">
          <i />
        </span>
        <span className="haze" />
      </div>
      <div className="p3d" aria-hidden="true" />
      <div className="b2d">
        <div className={"pfr " + p.cam} data-frame="1" ref={frameRef}>
          <div className="turf" aria-hidden="true">
            <Turf cam={p.cam} />
            <span className="vig" />
          </div>
          <div className="wm" style={vars({ "--wy": p.wmY })} aria-hidden="true">
            <b className={p.sysk % 2 ? "wa" : "wb"}>{hud.sysName}</b>
          </div>
          <div className="ledt" aria-hidden="true">
            <span className="mq">
              <b>{hud.ledTop}</b>
              <b>{hud.ledTop}</b>
            </span>
          </div>
          <div className="ledn" aria-hidden="true">
            <span className="mq">
              <b>{hud.ledNear}</b>
              <b>{hud.ledNear}</b>
            </span>
          </div>
          <svg className="tac-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <path className="heat" d={plan.heatD} style={vars({ d: `path('${plan.heatD}')` })} />
            {plan.dlOn && <path className="dline" d={plan.dlD} style={vars({ d: `path('${plan.dlD}')` })} />}
            {plan.tarrs.map((a) => (
              <path key={a.key} className={"tarr" + (a.c ? " " + a.c : "")} d={a.d} style={vars({ d: `path('${a.d}')` })} />
            ))}
          </svg>
          <div className="lks" aria-hidden="true">
            {view.links.map((l) => (
              <span key={l.key} className={"lk " + l.cls} style={vars({ "--x": l.x, "--y": l.y, "--l": l.l, "--a": l.a, "--d": l.d, "--rit": p.pulse })}>
                <b>
                  <i />
                </b>
              </span>
            ))}
            {view.badges.map((b) => (
              <span key={b.key} className={"lkb " + b.cls} style={vars({ "--x": b.x, "--y": b.y, "--d": b.d })}>
                {b.t}
              </span>
            ))}
          </div>
          <svg className="ink" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <g className="c-g">
              <path className="live" />
              <path className="swp" ref={swpRef} />
            </g>
          </svg>
          {p.cmp.map((m) => (
            <span key={m.key} className={"cmpg" + (m.cls ? " " + m.cls : "")} style={vars({ "--x": m.x, "--y": m.y })} aria-hidden="true" />
          ))}
          {view.gslots.map((g) => (
            <span key={g.i} className={"gs" + (p.kb === g.i ? " mg" : "")} style={vars({ "--x": g.x, "--y": g.y, "--sc": g.sc })} data-gs={g.i} aria-hidden="true">
              <i />
            </span>
          ))}
          {view.slots.map((e) => (
            <button
              key={e.i}
              type="button"
              className={"slot" + (e.on ? " on" : "") + (p.kb === e.i ? " hov" : "")}
              style={vars({ "--x": e.x, "--y": e.y, "--sc": e.sc })}
              data-slot={e.i}
              onClick={() => p.onSlot(e.i)}
              aria-label={e.aria}
              disabled={p.ro}
            >
              <span className="so" aria-hidden="true" />
              <Icon n="plus" w={18} />
              <b>{e.lab}</b>
            </button>
          ))}
          {view.cards.map((c) => (
            <PitchCromo key={c.id} c={c} showGal={p.showGal} mini={view.mini} hov={p.kb === c.i && p.selId !== c.id} focusable onTap={p.onCard} />
          ))}
          {dlhOn && (
            <button
              type="button"
              className="dl-h"
              style={vars({ "--x": plan.dlX, "--y": plan.dlY })}
              data-dline="1"
              onClick={p.onLine}
              aria-label={"Línea defensiva " + plan.defLine.toLowerCase() + ": arrastra para subirla o bajarla, o toca para cambiarla"}
            >
              <Icon n="swap" w={13} />
              <span>{lineTxt}</span>
            </button>
          )}
        </div>
        <div className="rowb">
          <div className="sysp" role="group" aria-label="Sistema de juego">
            <button type="button" className="ib" onClick={() => p.onSys(-1)} disabled={p.ro} aria-label="Sistema anterior">
              <Icon n="chevL" />
            </button>
            <button type="button" className={"sysn " + (p.sysk % 2 ? "sa" : "sb")} onClick={p.onSysPick} aria-label={"Sistema " + hud.sysName + ": elegir sistema"}>
              <small>SISTEMA</small>
              <b>{hud.sysName}</b>
            </button>
            <button type="button" className="ib" onClick={() => p.onSys(1)} disabled={p.ro} aria-label="Sistema siguiente">
              <Icon n="chevR" />
            </button>
          </div>
          <span className="sbdw">
            <button type="button" className="sbd" onClick={p.onQuimica} aria-label={"Química " + hud.qv + " de 100, " + hud.tier + ". Abrir la química"}>
              <small>QUÍMICA</small>
              <span className="t">{hud.tier}</span>
              <span className="flp" aria-hidden="true">
                {hud.qDigits.map((q, k) => (
                  <i key={k} className={q.k} style={vars({ "--d": q.d })}>
                    {q.v}
                  </i>
                ))}
              </span>
            </button>
            {hud.qUp > 0 && !hud.celeOn && (
              <span className="qup" aria-hidden="true">
                +{hud.qUp}
              </span>
            )}
          </span>
        </div>
      </div>
      <FxLayer cele={hud.celeOn} celeSub={p.celeSub} rw={p.rw} rwKey={p.fxk} />
      <div className="blk" aria-hidden="true" />
    </section>
  );
}
