// "La vitrina del escudo": the crest floating in a glass case that turns slowly under a spotlight, with
// dust in the beam. Pure CSS 3D (transform only); buttons to switch the room lights, pause and turn it.
import { useState, type CSSProperties } from "react";
import { Icon } from "../../components/celeste/icons";

const DUST = Array.from({ length: 14 }, (_, i) => ({ x: (i * 37) % 100, d: 6 + ((i * 7) % 6), w: ((i * 5) % 9) / 3 }));

export function Vitrina() {
  const [lit, setLit] = useState(true);
  const [paused, setPaused] = useState(false);
  const [turn, setTurn] = useState(0);
  return (
    <figure className={`cl-vitrina${lit ? " lit" : ""}${paused ? " paused" : ""}`} aria-label="El escudo del Manchester Piti en su vitrina">
      <div className="cl-room" aria-hidden="true">
        <i className="lamp" />
        <i className="beam" />
        <span className="dust">
          {DUST.map((p, i) => (
            <i key={i} style={{ left: `${p.x}%`, animationDuration: `${p.d}s`, animationDelay: `-${p.w}s` } as CSSProperties} />
          ))}
        </span>
      </div>
      <div className="cl-case-wrap" style={{ "--turn": `${turn}deg` } as CSSProperties} aria-hidden="true">
        <div className="cl-case">
          <i className="g front" />
          <i className="g back" />
          <i className="g left" />
          <i className="g right" />
          <i className="g top" />
          <div className="cl-crest">
            <img className="face" src="/crest-256.webp" alt="" width="180" height="180" />
            <span className="rear">
              <b>MP</b>
              <small>DESDE EL PRIMER BALÓN</small>
            </span>
          </div>
        </div>
        <i className="cl-base" />
      </div>
      <span className="cl-plinth">PIEZA Nº 01 · EL ESCUDO</span>
      <figcaption className="cl-ctrls">
        <button type="button" className="hm-ghostbtn st-sm" aria-pressed={lit} onClick={() => setLit(!lit)}>
          <Icon name="sun" size={16} />
          {lit ? "Apagar la sala" : "Encender la sala"}
        </button>
        <button type="button" className="cl-iconbtn" aria-label="Girar a la izquierda" onClick={() => setTurn(turn - 45)}>
          <Icon name="left" size={18} stroke={2.2} />
        </button>
        <button type="button" className="cl-iconbtn" aria-label={paused ? "Seguir girando" : "Pausar el giro"} onClick={() => setPaused(!paused)}>
          <Icon name={paused ? "play" : "pause"} size={16} />
        </button>
        <button type="button" className="cl-iconbtn" aria-label="Girar a la derecha" onClick={() => setTurn(turn + 45)}>
          <Icon name="right" size={18} stroke={2.2} />
        </button>
      </figcaption>
    </figure>
  );
}
