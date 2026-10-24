// «La moviola» in the sticky strip: once the header has scrolled away the moviola goes with the tabs, so the
// screen below (the siete, the números) can still be moved minute by minute. On a wide page it is «la cinta» (the
// ribbon, its plays, ‹ ▶ › and the minute with what happened); on the phone «el hilo» (a thin rail with the goals
// and the minute), so the strip only grows a little. The same verbs as the header's: one moviola, two handles.
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { PageCtx } from "./ctx";
import { Icon } from "./bits";
import { playheadTip, ribbonMarks, ribbonPaths } from "./moviola";

export interface TiraProps {
  c: PageCtx;
  /** The header is out of view: the strip carries the moviola (otherwise it is folded and inert). */
  on: boolean;
  playing: boolean;
  onPlay: () => void;
  onJump: (dir: 1 | -1) => void;
  onSeek: (m: number, fromDrag: boolean) => void;
}

export function Tira({ c, on, playing, onPlay, onJump, onSeek }: TiraProps) {
  const { minute: m, edge, duration, live, fase } = c;
  // the ribbon folds its marks by the room it really has (0 while the phone's rail is the one shown)
  const track = useRef<HTMLDivElement | null>(null);
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => setTrackW((w) => (Math.abs(el.offsetWidth - w) > 4 ? el.offsetWidth : w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pct = (x: number) => `${((x / duration) * 100).toFixed(2)}%`;
  const paths = ribbonPaths(c.pulse, edge, duration);
  const marks = trackW ? ribbonMarks(c.plays, edge, m, duration, trackW) : [];
  const goals = c.plays.filter((p) => p.m <= edge && (p.k === "gol" || p.k === "rival"));
  const { tip, at, cls } = playheadTip(c.plays, m, duration, live ? edge : null);
  const sc = c.score;
  const cn = ["pp-tira", live ? "is-live" : "", playing ? "is-playing" : ""].filter(Boolean).join(" ");
  return (
    <div className={cn} inert={!on}>
      <div className="pp-tira__bar">
        <button type="button" className="vd-glass vd-press vd-ibtn pp-tira__b" onClick={() => onJump(-1)} aria-label="Jugada anterior">
          <Icon name="chev-l" />
        </button>
        <button type="button" className="vd-glass vd-press vd-ibtn pp-tira__b pp-tira__play" onClick={onPlay} aria-pressed={playing} aria-label={playing ? "Pausa" : fase === "descanso" ? "Repasar la primera parte" : "Repasar el partido"}>
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <button type="button" className="vd-glass vd-press vd-ibtn pp-tira__b" onClick={() => onJump(1)} aria-label="Jugada siguiente">
          <Icon name="chev-r" />
        </button>
      </div>
      <div className="pp-tira__track" ref={track}>
        <div className="vd-ribbon pp-tira__rib" aria-hidden="true">
          <svg viewBox="0 14 500 46" preserveAspectRatio="none" focusable="false">
            <defs>
              <linearGradient id="pp-tira-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#EAF3FC" stopOpacity=".75" />
                <stop offset="1" stopColor="#6CABDD" stopOpacity=".12" />
              </linearGradient>
              <clipPath id="pp-tira-clip">
                <rect x="0" y="0" width={((m / duration) * 500).toFixed(1)} height="74" />
              </clipPath>
            </defs>
            <line className="vd-ribbon__axis" x1="0" y1="37" x2="500" y2="37" />
            <path className="vd-ribbon__us pp-tira__ghost" d={paths.us} fill="url(#pp-tira-grad)" />
            <path className="vd-ribbon__them pp-tira__ghost" d={paths.them} />
            <g clipPath="url(#pp-tira-clip)">
              <path className="vd-ribbon__us" d={paths.us} fill="url(#pp-tira-grad)" />
              <path className="vd-ribbon__them" d={paths.them} />
            </g>
          </svg>
          {marks.map((k) => (
            <span key={k.key} className={`vd-ribbon__mark ${k.cls}`} style={{ left: `${k.left}%`, top: k.top < 50 ? "28%" : "72%" }}>
              {k.icon && <Icon name={k.icon as "ball"} className="" />}
            </span>
          ))}
        </div>
        <div className="pp-tira__rail" aria-hidden="true">
          <span className="pp-tira__fill" style={{ width: pct(m) }} />
          {goals.map((g) => (
            <span key={g.id} className={`pp-tira__dot ${g.k === "gol" ? "is-gold" : "is-them"}${g.m > m ? " is-later" : ""}`} style={{ left: pct(g.m) }} />
          ))}
        </div>
        {live && <span className="vd-ribbon__now pp-tira__live" style={{ left: pct(edge) }} aria-hidden="true" />}
        <span className={`pp-tira__chip${cls ? ` ${cls}` : ""}`} style={{ left: pct(m) }} aria-hidden="true">
          <b className="vd-clock">{m}′</b>
          {tip && <span className="pp-tira__tip"> · {tip}</span>}
        </span>
        <input
          className="pp-tira__range"
          type="range"
          min={0}
          max={edge}
          step={1}
          value={m}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSeek(Number(e.target.value), true)}
          aria-label="La moviola: minuto del partido"
          aria-valuetext={`Minuto ${m}${at ? `, ${at.title}` : ""}. Marcador ${sc.us} a ${sc.them}`}
        />
      </div>
    </div>
  );
}
