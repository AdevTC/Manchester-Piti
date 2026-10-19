// The lens: the one glass object of Inicio, the match of the day. Our crest and the rival's, the score (or the
// kick-off, or the state in words), the status line and the ribbon: the momentum while it is played and after,
// the evening's light before it. It declares itself to the live system (useLiveDock "lens"): while it is on
// screen the floating score stays away, so the match is never shown twice.
import { useRef } from "react";
import { Lens, MomentumRibbon, useLiveDock, type GoalClasses, type RibbonItem } from "../../../components/vidrio";
import type { LensFace, SunRibbon } from "../hoyModel";

export interface HoyLensProps {
  face: LensFace;
  rival: string | null;
  /** Initials for the rival's crest («OR»). */
  rivalCode: string;
  home: boolean;
  items: readonly RibbonItem[];
  duration: number;
  /** The clock in minutes while live (the ribbon's «now»). */
  nowMinute?: number;
  sun: SunRibbon | null;
  goal: GoalClasses;
  /** Whose goal the digit roll is for (the digit that changed). */
  rollSide?: "us" | "them";
  /** The status line during a goal moment («¡Gol de Adrián T.C.!», then «Adrián T.C., minuto 21»). */
  goalStatus?: string | null;
  /** The forecast by the hour over the sun ribbon (before the match). */
  sunHours?: readonly SunHour[] | null;
  /** The score as a button that plays the last goal again (live; never with reduced motion). */
  onReplay?: () => void;
  className?: string;
}

export interface SunHour {
  /** % of the strip (the hour's middle). */
  left: number;
  temp: number;
  /** Rain probability when it is worth saying (≥ 40 %). */
  rain: number | null;
}

function SunStrip({ sun, hours }: { sun: SunRibbon; hours?: readonly SunHour[] | null }) {
  const said = hours?.length ? ` Por horas: ${hours.map((h) => `${h.temp}°${h.rain !== null ? `, lluvia ${h.rain} %` : ""}`).join("; ")}.` : "";
  return (
    <div className="vd-ribbon vi-sunribbon" role="img" aria-label={`${sun.label}${said}`}>
      <svg viewBox="0 0 500 74" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="vi-sunfill" x1="0" x2="1">
            <stop offset="0" stopColor="#F3B26B" stopOpacity=".55" />
            <stop offset={String((sun.focos ?? 100) / 100 - 0.02)} stopColor="#F3B26B" stopOpacity=".35" />
            <stop offset={String((sun.focos ?? 100) / 100)} stopColor="#6CABDD" stopOpacity=".25" />
            <stop offset="1" stopColor="#6CABDD" stopOpacity=".12" />
          </linearGradient>
        </defs>
        <rect x="0" y="46" width="500" height="28" fill="rgba(234,243,252,.05)" />
        <line className="vd-ribbon__axis" x1="0" y1="46" x2="500" y2="46" />
        <path d={`${sun.path} L500 46 L0 46 Z`} fill="url(#vi-sunfill)" />
        <path d={sun.path} fill="none" stroke="#F3B26B" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {sun.focos !== null && <rect x={sun.focos * 5} y="8" width={Math.max(0, 500 - sun.focos * 5)} height="66" fill="rgba(234,243,252,.10)" />}
        <line x1={sun.pitido * 5} y1="4" x2={sun.pitido * 5} y2="74" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="vi-sun" style={{ left: `${sun.sun}%` }} />
      {hours?.map((h) => (
        <span key={h.left} className="vi-sunhour" style={{ left: `${h.left}%` }} aria-hidden="true">
          {h.temp}°{h.rain !== null && <i>lluvia {h.rain} %</i>}
        </span>
      ))}
      {sun.labels.map((l) => (
        <span key={l.text} className={`vd-ribbon__lab vd-ribbon__lab--${l.align}${l.text === "focos" ? " vi-lab-focos" : ""}`} style={{ left: `${l.left}%` }}>
          {l.text}
        </span>
      ))}
    </div>
  );
}

export function HoyLens({ face, rival, rivalCode, home, items, duration, nowMinute, sun, sunHours, goal, rollSide = "us", goalStatus, onReplay, className }: HoyLensProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLiveDock(ref, "lens");
  const status = goalStatus ? { live: face.status.live, clock: null, text: goalStatus } : face.status;
  const digits = (
    <>
      <span className={`vd-digit${rollSide === "us" && goal.digit ? ` ${goal.digit}` : ""}`} aria-hidden="true">
        {face.gf}
      </span>
      <span className="vd-scoreline__sep" aria-hidden="true" />
      <span className={`vd-digit${rollSide === "them" && goal.digit ? ` ${goal.digit}` : ""}`} aria-hidden="true">
        {face.ga}
      </span>
    </>
  );
  return (
    <div ref={ref} className={`vi-lensbox${goal.root ? ` ${goal.root}` : ""}${className ? ` ${className}` : ""}`}>
      <Lens as="section" aria-label="El partido" className={`vi-lens${goal.rim ? " vd-rim-gold" : ""}`} goal={[goal.lens, goal.glint].filter(Boolean).join(" ")} refract={{ bezel: 36, strength: 1.35, blur: 8 }}>
        <span className="vi-lens__halo" aria-hidden="true" />
        <div className="vd-teams">
          <div className="vd-team">
            <img className="vd-team__crest" src="/crest-128.webp" alt="" width={68} height={68} />
            <b>
              <span className="vi-long">Manchester Piti</span>
              <span className="vi-short">Piti</span>
            </b>
            {rival && <span>{home ? "En casa" : "Fuera"}</span>}
          </div>
          {face.mode === "score" && onReplay ? (
            <button type="button" className="vd-scoreline vd-score vi-score vi-scorebtn" aria-label={`${face.label} Repetir el gol`} onClick={onReplay}>
              {digits}
            </button>
          ) : face.mode === "score" ? (
            <p className="vd-scoreline vd-score vi-score" role="img" aria-label={face.label}>
              {digits}
            </p>
          ) : face.mode === "time" ? (
            <p className="vi-count" role="img" aria-label={face.label}>
              <span className="vd-score vd-digit vi-count__t" aria-hidden="true">
                {face.big}
              </span>
              <span aria-hidden="true">{face.under}</span>
            </p>
          ) : (
            <p className="vi-word" role="img" aria-label={face.label}>
              <span className="vd-score vd-digit vi-word__t" aria-hidden="true">
                {face.big}
              </span>
            </p>
          )}
          <div className="vd-team">
            {rival ? (
              <>
                <span className="vd-team__crest vd-team__crest--rival" aria-hidden="true">
                  {rivalCode}
                </span>
                <b>{rival}</b>
                <span>{home ? "Fuera" : "En casa"}</span>
              </>
            ) : (
              <span className="vd-team__crest vd-team__crest--rival vi-crest-empty" aria-hidden="true" />
            )}
          </div>
        </div>
        {status.text && (
          <p className="vd-status">
            {status.live && <span className="vd-live">En directo</span>}
            {status.clock && <span className="vd-clock">{status.clock}</span>}
            <span>{status.text}</span>
          </p>
        )}
        {face.ribbon === "momentum" && <MomentumRibbon items={items} duration={duration} now={nowMinute} peakClassName={goal.peak || undefined} label={`El partido minuto a minuto: arriba aprieta el Piti, abajo ${rival ?? "el rival"}`} />}
        {face.ribbon === "sun" && sun && <SunStrip sun={sun} hours={sunHours} />}
      </Lens>
    </div>
  );
}
