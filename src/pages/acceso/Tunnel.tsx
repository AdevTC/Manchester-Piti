// The LED tunnel (CSS 3D): two walls and a ceiling of LED panels, a reflective floor and the floodlit
// pitch at the end. `k` reprograms the panels (palette, camera depth, effects); the texts scroll on
// them. It pauses itself while offscreen (or when the tab is hidden) so the loops cost nothing.
import { Fragment, memo, useEffect, useRef, type CSSProperties } from "react";

export type LedKey = "puerta" | "load" | "inv" | "cad" | "quien" | "pick" | "pend" | "okd" | "rech" | "bien" | "cap" | "capok";
export interface LedTexts {
  a: string;
  a2: string;
  b: string;
  end: string;
  ceil: string[];
}

const DUST = Array.from({ length: 22 }, (_, i) => ({ "--x": ((i * 41) % 100) + "%", "--y": 20 + ((i * 29) % 60) + "%", "--d": 6 + ((i * 3) % 7) + "s", "--w": (-((i * 1.3) % 8)).toFixed(1) + "s", "--s": 1 + (i % 3) + "px" }));
const FLASH = Array.from({ length: 34 }, (_, i) => ({ "--x": ((i * 37) % 100) + "%", "--y": ((i * 53) % 90) + "%", "--d": (-((i * 0.71) % 4)).toFixed(2) + "s" }));
const CONFETTI = Array.from({ length: 46 }, (_, i) => ({
  "--x": ((i * 37) % 100) + "%",
  "--r": ((i * 53) % 180) + "deg",
  "--d": (1.8 + ((i * 7) % 10) / 10).toFixed(2) + "s",
  "--w": ((i * 3) % 9) / 20 + "s",
  "--c": ["#6CABDD", "#FFC659", "#eef4ff", "#9fd0f2", "#ffe0a0"][i % 5],
}));
const repeat = (s: string, n: number) => Array.from({ length: n }, () => s).join("  ·  ") + "  ·  ";

function CrestRow() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Fragment key={i}>
          <img src="/crest-128.webp" alt="" />
          <b>MANCHESTER PITI</b>
        </Fragment>
      ))}
    </>
  );
}

function Panel({ side, a, b }: { side: "l" | "r"; a: string; b: string }) {
  return (
    <div className={`tn-${side}`}>
      <div className="ld">
        <div className="ld-row r1">
          <span className="mq">
            <b>{a}</b>
            <b>{a}</b>
          </span>
        </div>
        <div className="ld-row r2">
          <span className="mq">
            <b>{b}</b>
            <b>{b}</b>
          </span>
        </div>
        <div className="ld-row r3">
          <span className="mq">
            <CrestRow />
          </span>
        </div>
        <div className="ld-row r4" />
        <div className="kick" />
        <div className="fog" />
        <span className="lit" />
        <span className="dk" />
        <span className="eng" />
        <span className="off" />
      </div>
    </div>
  );
}

/** The camera follows --mx/--my (-1…1), inherited from any ancestor (the stage sets them on the page). */
export const Tunnel = memo(function Tunnel({ k, led, take, monitor = false }: { k: LedKey; led: LedTexts; take: number; monitor?: boolean }) {
  const own = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = own.current;
    if (!el) return;
    let seen = true;
    const sync = () => (seen && !document.hidden ? el.removeAttribute("data-paused") : el.setAttribute("data-paused", ""));
    const io = new IntersectionObserver(([e]) => {
      seen = !!e?.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const ceil = [...led.ceil, ...led.ceil];
  return (
    <div ref={own} className={`tn ${take % 2 ? "kb pb" : "ka pa"}${monitor ? " mon-tn" : ""}`} data-k={k} aria-hidden="true">
      <div className="tn-cam">
        <div className="tn-box">
          <div className="tn-end">
            <div className="te-sky" />
            <span className="te-mast a" />
            <span className="te-mast b" />
            <div className="te-board">
              <span key={led.end}>{led.end}</span>
            </div>
            <div className="te-stand">
              {FLASH.map((f, i) => (
                <i key={i} style={f as CSSProperties} />
              ))}
            </div>
            <div className="te-pitch" />
            <div className="te-glow" />
            <div className="te-shut" />
          </div>
          <Panel side="l" a={repeat(led.a, 3)} b={repeat(led.b, 4)} />
          <Panel side="r" a={repeat(led.a2, 3)} b={repeat(led.b, 4)} />
          <div className="tn-c">
            <div className="ld">
              <div className="rails" />
              <div className="lc">
                {ceil.map((t, i) => (
                  <b key={i}>{t}</b>
                ))}
              </div>
              <div className="fog" />
              <span className="lit" />
              <span className="dk" />
              <span className="eng" />
              <span className="off" />
            </div>
          </div>
          <div className="tn-f">
            <div className="fl-refl" />
            <div className="fl-sheen" />
            <div className="fl-line" />
            <div className="fl-run a" />
            <div className="fl-run b" />
          </div>
        </div>
      </div>
      <div className="tn-glow" />
      <div className="tn-rays" />
      <div className="tn-haze">
        <i />
        <i />
      </div>
      <div className="tn-dust">
        {DUST.map((d, i) => (
          <i key={i} style={d as CSSProperties} />
        ))}
      </div>
      {k === "bien" && (
        <>
          <div className="tn-flash" />
          <div className="tn-pyro">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <div className="confetti">
              {CONFETTI.map((c, i) => (
                <i key={i} style={c as CSSProperties} />
              ))}
            </div>
          </div>
        </>
      )}
      <div className="tn-vig" />
      <div className="tn-top" />
      <div className="tn-scrim" />
    </div>
  );
});
