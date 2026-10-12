// Bloque 5 · modo presentación on screen: the big LED ribbon along the top (a marquee; still with reduced
// motion) and the controls along the bottom — the jugada's transport (paso anterior, play / pause, paso
// siguiente) while a jugada is on, «La charla» and «Jugadas» otherwise — and «Salir» (Esc). La charla
// keeps its own transport (moved to the bottom by the CSS); here only «Salir» joins it. The safe areas
// of the screen are respected by the CSS (pizarra-presenta.css).
import { useEffect, useRef } from "react";
import { Icon } from "./icons";
import "../../../styles/pizarra-presenta.css";

export interface PresentaBarProps {
  led: string[];
  modo: "charla" | "jugadas" | "otro";
  /** The jugada's transport (Jugadas). */
  jugada?: { txt: string; playing: boolean; onToggle: () => void; onStep: (d: 1 | -1) => void } | null;
  onCharla: () => void;
  onJugadas: () => void;
  onExit: () => void;
}

export function PresentaBar({ led, modo, jugada, onCharla, onJugadas, onExit }: PresentaBarProps) {
  const first = useRef<HTMLButtonElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  // the presentation's controls take the focus when it opens (la charla's own transport keeps it there)
  const opened = useRef(modo);
  useEffect(() => {
    if (opened.current === "charla") return;
    (first.current ?? exitRef.current)?.focus({ preventScroll: true });
  }, []);
  const txt = led.join("  ·  ");
  return (
    <>
      <div className="b5p-led" aria-hidden="true">
        <span className="b5p-led-mq">
          <b>{txt}</b>
          <b>{txt}</b>
        </span>
      </div>
      <div className={"b5p-pbar" + (modo === "charla" ? " ch" : "")} role="toolbar" aria-label="Modo presentación">
        {modo === "jugadas" && jugada && (
          <>
            <button type="button" ref={first} className="ib" onClick={() => jugada.onStep(-1)} aria-label="Paso anterior">
              <Icon n="prev" />
            </button>
            <button type="button" className="ib pl" onClick={jugada.onToggle} aria-label={jugada.playing ? "Pausar la jugada" : "Reproducir la jugada"}>
              {jugada.playing ? <Icon n="pause" w={22} /> : <Icon n="play" w={22} />}
            </button>
            <button type="button" className="ib" onClick={() => jugada.onStep(1)} aria-label="Paso siguiente">
              <Icon n="next" />
            </button>
            <span className="b5p-pbar-t">{jugada.txt}</span>
            <button type="button" className="b3" onClick={onCharla}>
              <Icon n="whistle" w={16} />
              La charla
            </button>
          </>
        )}
        {modo === "otro" && (
          <>
            <button type="button" ref={first} className="b3 gold" onClick={onCharla}>
              <Icon n="whistle" w={16} />
              La charla
            </button>
            <button type="button" className="b3" onClick={onJugadas}>
              <Icon n="film" w={16} />
              Jugadas
            </button>
          </>
        )}
        <button type="button" ref={exitRef} className="b3 b5p-pbar-x" onClick={onExit} aria-label="Salir del modo presentación (Esc)">
          <Icon n="x" w={16} />
          Salir
        </button>
      </div>
    </>
  );
}
