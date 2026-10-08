// La charla on screen: the broadcast graphics over the pitch (the bug with the match and the step
// counter, the big word, the lower third of each step, the plan's consigna cards) and the transport
// (progress segments, prev / play-pause / next, the timeline, «Salir»); and, in the sheet (desktop), the
// running order. The board decides the step (charla.ts, useCharla.ts) and tells screen readers what
// each step says; this only draws it.
import { useEffect, useRef } from "react";
import { Icon } from "./icons";
import { mag } from "./mag";
import { vars } from "./view";
import type { CharlaView } from "./charla";

export interface CharlaOverlayProps {
  v: CharlaView;
  step: number;
  playing: boolean;
  /** Reduced motion: the big button walks the charla one step at a time. */
  rm: boolean;
  onToggle: () => void;
  onStep: (d: 1 | -1) => void;
  onSeek: (i: number) => void;
  onExit: () => void;
}

export function CharlaOverlay({ v, step, playing, rm, onToggle, onStep, onSeek, onExit }: CharlaOverlayProps) {
  const running = playing && step < v.last;
  // The transport takes the focus while the charla is on (the app bar that opened it is hidden on
  // phones) and gives it back when it closes.
  const playRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    playRef.current?.focus({ preventScroll: true });
    return () => {
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, []);
  const playLab = rm ? (step >= v.last ? "Volver al principio de la charla" : "Avanzar la charla un paso") : running ? "Pausar la charla" : "Reproducir la charla";
  return (
    <div className="ch">
      <div className="ch-top">
        <div className="bug">
          <i aria-hidden="true" />
          <div>
            <small>{v.kick}</small>
            <b>{v.title}</b>
          </div>
        </div>
        <span className="ch-n" role="status" aria-label={"Paso " + v.n + ": " + v.nk.toLowerCase()}>
          <b>{v.n}</b>
          <small>{v.nk}</small>
        </span>
        <button type="button" className="ib" onClick={onExit} aria-label="Salir de la charla">
          <Icon n="x" />
        </button>
      </div>
      {v.big && (
        <div key={"big" + step} className={"ch-big" + (v.big.fin ? " fin" : "")} aria-hidden="true">
          <b>{v.big.txt}</b>
        </div>
      )}
      {v.lt && (
        <div className={"ch-lt " + (step % 2 ? "ka" : "kb")}>
          <span className={"lt-n" + (v.lt.nSm ? " sm" : "")}>{v.lt.n}</span>
          <div className="lt-t">
            <small>{v.lt.k}</small>
            <strong>{v.lt.t}</strong>
            {v.lt.d && <span>{v.lt.d}</span>}
            {v.lt.gal.length > 0 && (
              <span className="lt-gal">
                {v.lt.gal.map((g) => (
                  <i key={g.l}>
                    <b>{g.l}</b>
                    {g.t}
                  </i>
                ))}
              </span>
            )}
          </div>
        </div>
      )}
      {v.plan && (
        <div className="ch-plan">
          {v.plan.map((c) => (
            <div key={c.t} style={vars({ "--d": c.dl })}>
              <b>{c.t}</b>
              <span>{c.d}</span>
            </div>
          ))}
        </div>
      )}
      <div className="ch-ctl" role="group" aria-label="Controles de la charla">
        <div className="ch-seg" aria-hidden="true">
          {v.segs.map((s, k) => (
            <i key={k + ":" + (s.cls === "cur" ? step : "")} className={s.cls} style={vars({ "--w": s.w, "--t": s.t })} />
          ))}
        </div>
        <div className="ch-b">
          <button type="button" className="ib" onClick={() => onStep(-1)} disabled={step <= 0} aria-label="Paso anterior">
            <Icon n="prev" />
          </button>
          <button type="button" ref={playRef} className="ib pl mag" {...mag} onClick={onToggle} aria-label={playLab}>
            {running ? <Icon n="pause" w={22} /> : <Icon n="play" w={22} />}
          </button>
          <button type="button" className="ib" onClick={() => onStep(1)} disabled={step >= v.last} aria-label="Paso siguiente">
            <Icon n="next" />
          </button>
          <input
            type="range"
            min={0}
            max={v.last}
            step={1}
            value={step}
            onChange={(e) => onSeek(+e.target.value)}
            aria-label="Momento de la charla"
            aria-valuetext={v.n + " · " + v.nk.toLowerCase()}
          />
          <button type="button" className="b3" onClick={onExit}>
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}

/** The sheet in the charla (desktop): the running order, with the step on screen marked. */
export function CharlaGuion({ v, title, note3d }: { v: CharlaView; title: string; note3d: string }) {
  return (
    <>
      <div className="sh-h">
        <div>
          <span className="k2">La charla · {title}</span>
          <h2>El guion</h2>
        </div>
        <span className="cnt">{v.n}</span>
      </div>
      <ol className="guion">
        {v.guion.map((g) => (
          <li key={g.n} className={g.cls} aria-current={g.cls === "now" ? "step" : undefined}>
            <b>{g.n}</b>
            <span>{g.t}</span>
          </li>
        ))}
      </ol>
      <p className="fb3">
        <Icon n="cube" w={16} />
        <span>{note3d}</span>
      </p>
    </>
  );
}
