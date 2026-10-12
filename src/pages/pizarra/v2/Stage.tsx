// The stadium: stands with camera flashes, masts and sweeping beams, the TV-camera pitch with the system
// mowed into the grass, the LED boards, the plan painted on the turf (presión, línea defensiva), the
// química as light, the telestrator's strokes, the slots and the cromos (the ones a player in the hand
// can go to glow), the línea's round handle on the touchline and, on the apron, the selected player's
// action bar. A jugada puts its paso on the pitch instead (discs, rivals, the ball, the calco and the
// estelas, the follow-cam); la charla turns the cromos one by one under a spotlight, with the camera
// pushing in; the 3D stadium plays under it all. (The system, the química scoreboard and the
// «REPETICIÓN» bug live in the command bar.)
import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { FLASHES, pitchArt, type CamName } from "./geometry";
import { nudgeOf } from "./drag";
import { BallMark, Icon, RivalMark } from "./icons";
import { PitchCromo } from "./Cromos";
import { FxLayer } from "./Overlays";
import { vars, type Hud, type PitchView, type PlanLayer } from "./view";
import type { CmpMark } from "./compare";
import type { InkPath, InkText } from "./telestrator";
import type { JugadaStage } from "./jugadas";

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
  rw: string;
  fxk: number;
  pulse: string;
  /** Comparar: who would come in (dashed gold) and go out (red), on the pitch. */
  cmp: CmpMark[];
  /** The telestrator's strokes (none while a jugada is on the pitch). */
  ink: { paths: InkPath[]; texts: InkText[] } | null;
  /** A jugada's paso on the pitch, instead of the board's seven. */
  jug: JugadaStage | null;
  /** The paso's pieces can be moved (they carry data-piece). */
  pieces: boolean;
  /** The cromos are reached with Tab (not when they are only part of a drawing or a jugada). */
  focusCards: boolean;
  /** The selected player's action bar on the pitch's apron (tablet; desktop on a touch screen). */
  selbar?: ReactNode;
  /** The estelas draw themselves (a glide is on) or are simply there. */
  trailsDraw: boolean;
  trailsDur: string;
  /** The crest wipe (its run number), or null. */
  wipe: number | null;
  /** The 3D stadium's layer content (the intro, the charla, «En 3D»). */
  p3d?: ReactNode;
  /** The 2D camera's transform of the frame (the charla pushing in), over the follow-cam's. */
  camT?: string | null;
  /** The spotlight under the cromo the charla presents (frame %; `ar` = the captain's armband ring). */
  spot?: { id: string; x: number; y: number; ar: boolean } | null;
  /** The big flash with sparks: «¡SIETE LISTO!» (or none, at «¡A por ellos!»). */
  cele: { txt: string; sub: string } | null;
  frameRef: RefObject<HTMLDivElement | null>;
  swpRef: RefObject<SVGPathElement | null>;
  liveRef: RefObject<SVGPathElement | null>;
  onCard: (id: string, el: HTMLElement) => void;
  onSlot: (i: number) => void;
  onLine: () => void;
  /** The pieces' names for screen readers, by piece («b», «r:<id>»): what it is and where. */
  pieceAria?: Record<string, string>;
  /** A focused piece moved with the arrows (pitch %). */
  onPieceKey?: (piece: string, dx: number, dy: number) => void;
  /** Enter / Space on a rival: marks it (as a tap does). */
  onPieceTap?: (piece: string) => void;
  /** Bloque 4's layer inside the frame (DrawLayer: pinned strokes, the rival, the paths' handles). */
  extras?: ReactNode;
}

export function Stage({ frameRef, swpRef, liveRef, ...p }: StageProps) {
  const { view, plan, hud, jug } = p;
  const cards = jug ? jug.cards : view.cards;
  const camT = p.camT ?? (jug && jug.camT !== "none" ? jug.camT : null);
  const stage = useRef<HTMLElement>(null);
  // Loops (and anything heavy) pause while the stadium is offscreen.
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // (on the stage, and on the board's root for the chrome's loops: the charla's shine, the targets' pulse)
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      for (const t of [e.target, e.target.closest(".pzv")]) {
        if (!t) continue;
        if (e.isIntersecting) t.removeAttribute("data-paused");
        else t.setAttribute("data-paused", "");
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // A focused piece of the paso: the arrows move it (Shift: further), Enter / Space marks a rival.
  // (handled here first: the replay's own ← → never see these)
  const onPieceKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!p.pieces || e.altKey || e.ctrlKey || e.metaKey) return;
    const piece = (e.target as Element).closest("[data-piece]")?.getAttribute("data-piece");
    if (!piece) return;
    const d = nudgeOf(e.key, e.shiftKey);
    if (d) {
      e.preventDefault();
      p.onPieceKey?.(piece, d[0], d[1]);
    } else if ((e.key === "Enter" || e.key === " ") && piece.startsWith("r:")) {
      e.preventDefault();
      p.onPieceTap?.(piece);
    }
  };
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
      <div className="p3d" aria-hidden="true">
        {p.p3d}
      </div>
      <div className="b2d">
        <div className={"pfr " + p.cam} data-frame="1" ref={frameRef} style={camT ? { transform: camT } : undefined} onKeyDown={onPieceKeys}>
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
          {p.spot && (
            <span key={p.spot.id} className={"spot" + (p.spot.ar ? " ar" : "")} style={vars({ "--x": p.spot.x, "--y": p.spot.y })} aria-hidden="true">
              <i />
            </span>
          )}
          <div className="lks" aria-hidden="true">
            {!jug && view.links.map((l) => (
              <span key={l.key} className={"lk " + l.cls} style={vars({ "--x": l.x, "--y": l.y, "--l": l.l, "--a": l.a, "--d": l.d, "--rit": p.pulse })}>
                <b>
                  <i />
                </b>
              </span>
            ))}
            {!jug && view.badges.map((b) => (
              <span key={b.key} className={"lkb " + b.cls} style={vars({ "--x": b.x, "--y": b.y, "--d": b.d })}>
                {b.t}
              </span>
            ))}
          </div>
          <svg className="ink" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            {p.ink?.paths.map((k) => (
              <g key={k.id} className={k.cls + (k.sel ? " sel" : "")} style={vars({ "--dl": k.dl })}>
                {k.zone && <path className="zf" d={k.zone} />}
                {k.dash && <path className="dt drw" pathLength={100} d={k.dash} />}
                {k.solid && <path className="ln2 drw" pathLength={1} d={k.solid} />}
                {k.head && <path className="hd drw" d={k.head} />}
              </g>
            ))}
            {jug?.trails.map((t) => (
              <g key={t.key + ":" + p.fxk} className={t.cls}>
                <path className={"tr" + (t.k ? " " + t.k : "") + (p.trailsDraw ? "" : " st")} pathLength={1} d={t.d} style={vars({ "--td": p.trailsDur })} />
              </g>
            ))}
            <g className="c-g">
              <path className="live" ref={liveRef} />
              <path className="swp" ref={swpRef} />
            </g>
          </svg>
          {p.ink?.texts.map((t) => (
            <span key={t.id} className={"itx " + t.cls + (t.sel ? " sel" : "")} style={vars({ "--x": t.x, "--y": t.y })} aria-hidden="true">
              {t.text}
            </span>
          ))}
          {jug?.ghosts.map((g) => (
            <span key={g.key} className="gh" style={vars({ "--x": g.x, "--y": g.y, "--sc": g.sc })} aria-hidden="true" />
          ))}
          {p.extras}
          {p.cmp.map((m) => (
            <span key={m.key} className={"cmpg" + (m.cls ? " " + m.cls : "")} style={vars({ "--x": m.x, "--y": m.y })} aria-hidden="true" />
          ))}
          {/* (while a paso is edited the rivals and the ball are buttons too: Tab, the arrows move them) */}
          {jug?.rivals.map((r) => {
            const cls = "rv " + r.cls + (r.sel ? " sel" : "");
            const style = vars({ "--x": r.x, "--y": r.y, "--fx": r.fx, "--fy": r.fy, "--mx": r.mx, "--my": r.my, "--sc": r.sc });
            return p.pieces ? (
              <button key={r.id} type="button" className={cls} style={style} data-piece={"r:" + r.id} aria-pressed={!!r.sel} aria-label={p.pieceAria?.["r:" + r.id] ?? "Rival"}>
                <RivalMark />
              </button>
            ) : (
              <span key={r.id} className={cls} style={style} aria-hidden="true">
                <RivalMark />
              </span>
            );
          })}
          {jug?.ball &&
            (p.pieces ? (
              <button
                type="button"
                className={"ball " + jug.ball.cls}
                style={vars({ "--x": jug.ball.x, "--y": jug.ball.y, "--fx": jug.ball.fx, "--fy": jug.ball.fy, "--mx": jug.ball.mx, "--my": jug.ball.my })}
                data-piece="b"
                aria-label={p.pieceAria?.b ?? "Balón"}
              >
                <BallMark />
              </button>
            ) : (
              <span
                className={"ball " + jug.ball.cls}
                style={vars({ "--x": jug.ball.x, "--y": jug.ball.y, "--fx": jug.ball.fx, "--fy": jug.ball.fy, "--mx": jug.ball.mx, "--my": jug.ball.my })}
                aria-hidden="true"
              >
                <BallMark />
              </span>
            ))}
          {!jug && view.gslots.map((g) => (
            <span key={g.i} className={"gs" + (p.kb === g.i ? " mg" : "")} style={vars({ "--x": g.x, "--y": g.y, "--sc": g.sc })} data-gs={g.i} aria-hidden="true">
              <i />
            </span>
          ))}
          {!jug && view.slots.map((e) => (
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
          {cards.map((c) => (
            <PitchCromo
              key={c.id}
              c={c}
              showGal={p.showGal}
              mini={jug ? true : view.mini}
              hov={!jug && p.kb === c.i && p.selId !== c.id}
              focusable={p.focusCards || (!!jug && p.pieces)}
              piece={jug && p.pieces ? "p:" + c.id : undefined}
              onTap={p.onCard}
            />
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
        {p.selbar}
      </div>
      <FxLayer cele={p.cele} rw={p.rw} rwKey={p.fxk} wipe={p.wipe} />
      <div className="blk" aria-hidden="true" />
    </section>
  );
}
