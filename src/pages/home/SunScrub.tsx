// «Arrastra el sol»: a real slider over the match day's afternoon (14:00–21:00, Madrid). Before the kick-off it
// shows the countdown at that minute, during the match the score, the plays and the seven at that minute, after
// it the final. Snaps at the kick-off, half-time and the final whistle; «Volver a ahora» leaves the scrub.
// Keyboard: ←/→ (↑/↓) five minutes, Re Pág / Av Pág half an hour, Inicio 14:00, Fin 21:00, Esc back to now.
import { useId, type KeyboardEvent } from "react";
import { lightingOf, madridMinutes, SCRUB0, SCRUB1 } from "../../components/palomeras3d";
import { madridTime } from "../../lib/derived/madrid";
import { snapMinutes, trackFraction } from "./inicioModel";

export interface ScrubMark {
  key: "pitido" | "descanso" | "final";
  label: string;
  at: number;
}

interface Props {
  /** The instant shown (now, or the scrubbed one). */
  at: number;
  scrubbing: boolean;
  marks: readonly ScrubMark[];
  /** What the shown minute means: «faltan 24 min», «minuto 21, 2–1», «final, 3–1». */
  what: string;
  /** Madrid minutes → ms on the match's day. */
  toMs: (minutes: number) => number;
  onScrub: (ms: number) => void;
  onNow: () => void;
}

const STEP = 5;

/** The track's colours: the sky's horizon across the afternoon. */
function dayGradient(toMs: (minutes: number) => number): string {
  const stops: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const min = SCRUB0 + ((SCRUB1 - SCRUB0) * i) / 7;
    const sky = lightingOf(toMs(min)).sky;
    stops.push(`${i < 6 ? sky.mid : sky.top} ${((i / 7) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function SunScrub({ at, scrubbing, marks, what, toMs, onScrub, onNow }: Props) {
  const id = useId();
  const value = Math.round(Math.max(SCRUB0, Math.min(SCRUB1, madridMinutes(at))));
  const markMinutes = marks.map((m) => Math.round(madridMinutes(m.at)));
  const set = (v: number) => onScrub(toMs(Math.max(SCRUB0, Math.min(SCRUB1, v))));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const d = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP, PageUp: 30, PageDown: -30 }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      set(value + d);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      set(e.key === "Home" ? SCRUB0 : SCRUB1);
    } else if (e.key === "Escape" && scrubbing) {
      e.preventDefault();
      onNow();
    }
  };
  const time = madridTime(at);
  return (
    <div className="ei-scrub">
      <div className="ei-scrub-top">
        <label htmlFor={id}>Arrastra el sol</label>
        <span className="t">{time}</span>
        <span className="w">{what}</span>
        {scrubbing && (
          <button type="button" className="ei-now" onClick={onNow}>
            Volver a ahora
          </button>
        )}
      </div>
      <div className="ei-track">
        <div className="ei-track-bg" style={{ background: dayGradient(toMs) }} aria-hidden="true" />
        {marks.map((m) => (
          <span key={m.key} className="ei-track-tk" style={{ left: `${(trackFraction(m.at) * 100).toFixed(1)}%` }} aria-hidden="true" />
        ))}
        <span className="ei-thumb" style={{ left: `${(trackFraction(at) * 100).toFixed(1)}%` }} aria-hidden="true" />
        <input
          id={id}
          className="ei-range"
          type="range"
          min={SCRUB0}
          max={SCRUB1}
          step={1}
          value={value}
          aria-valuetext={`${time}, ${what}`}
          onKeyDown={onKey}
          onChange={(e) => set(snapMinutes(Number(e.currentTarget.value), markMinutes))}
        />
      </div>
      {marks.length > 0 && (
        <div className="ei-snaps" role="group" aria-label="Saltar a un momento del partido">
          {marks.map((m) => (
            <button key={m.key} type="button" className="ei-snap" aria-pressed={scrubbing && Math.abs(at - m.at) < 90_000} onClick={() => onScrub(m.at)}>
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
