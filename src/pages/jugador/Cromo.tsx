// The player's holographic cromo: it tilts under the pointer (CSS variables written straight to the
// element, no re-render), turns over to show the season's numbers, and enters after a short stadium
// presentation ("CON EL DORSAL… 10"). Reduced motion: no presentation, no tilt.
import { useRef, useState, type PointerEvent } from "react";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { Icon } from "../../components/celeste/icons";

export interface CromoFace {
  name: string;
  num: string;
  position: string;
  historic: boolean;
  photo?: string;
  still?: string;
  badges: string[];
  /** Front strip: three headline numbers. */
  headline: [string, string | number][];
  /** Back: the season's numbers. */
  back: [string, string | number][];
  period: string;
}

export function Cromo({ face, run }: { face: CromoFace; run: number }) {
  const card = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = card.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--hyp", String(Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2)));
  };
  const leave = () => {
    const el = card.current;
    if (!el) return;
    for (const k of ["--rx", "--ry", "--mx", "--my", "--hyp"]) el.style.removeProperty(k);
  };
  return (
    <div className="jg-stage" key={run}>
      <div className="jg-intro" aria-hidden="true">
        <span className="who">CON EL DORSAL…</span>
        <span className="num">{face.num || "·"}</span>
        <i className="ring" />
      </div>
      <div className={`jg-cromo${flipped ? " flipped" : ""}`} ref={card} onPointerMove={move} onPointerLeave={leave}>
        <div className="jg-face front" aria-hidden={flipped}>
          <div className="jg-art">
            {face.photo ? <img src={face.photo} alt="" /> : face.still ? <img src={face.still} alt="" /> : <ShirtBack name={face.name.toUpperCase()} num={face.num} />}
          </div>
          <div className="jg-top">
            <span className="n">{face.num || "–"}</span>
            <span className="p">{face.position}</span>
            {face.historic && <span className="h">HISTÓRICO</span>}
          </div>
          <div className="jg-plate">
            <b>{face.name}</b>
            {face.badges.length > 0 && (
              <span className="bd">
                {face.badges.map((b) => (
                  <i key={b}>{b}</i>
                ))}
              </span>
            )}
            <dl>
              {face.headline.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <i className="foil" />
          <i className="glare" />
        </div>
        <div className="jg-face back" aria-hidden={!flipped}>
          <span className="t">{face.period}</span>
          <dl>
            {face.back.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <span className="crest">
            <img src="/crest-128.webp" alt="" /> Manchester Piti
          </span>
          <i className="foil" />
        </div>
      </div>
      <button type="button" className="hm-ghostbtn jg-turn" onClick={() => setFlipped(!flipped)} aria-pressed={flipped}>
        <Icon name="turn" size={16} />
        {flipped ? "Ver el frente" : "Darle la vuelta"}
      </button>
    </div>
  );
}
