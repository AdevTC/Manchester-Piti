// The light of that evening: the sun's height over Palomeras from two hours before a kick-off to two hours after
// (sun.ts), drawn under the previa's big time with the kick-off band, the sunset («focos») and the hours. Pure.
import { sunPosition, sunTimes } from "../../../lib/derived/sun";
import { clockTime } from "./model";

const MIN = 60_000;

export interface SunCurve {
  /** The sun's height from two hours before the kick-off to two hours after (500 × 74 box). */
  d: string;
  /** Where the sun sets on the box (0–1), or null outside it. */
  sunset: number | null;
  /** The kick-off band (x, width). */
  kick: { x: number; w: number };
  /** The sun at the whistle (% from the top), null under the horizon. */
  sunY: number | null;
  labels: { left: number; text: string; align: "start" | "middle" | "end" }[];
  /** «La luz de esa tarde: el sol se pone a las 18:42». */
  aria: string;
}

/** The light curve under the previa's big time. */
export function sunCurve(kickoff: number, duration = 50): SunCurve {
  const t0 = kickoff - 120 * MIN;
  const span = 240 * MIN;
  const y = (el: number) => 46 - Math.max(-10, Math.min(40, el));
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = t0 + (i / 48) * span;
    pts.push(`${i ? "L" : "M"}${((i / 48) * 500).toFixed(1)} ${y(sunPosition(t).elevation).toFixed(1)}`);
  }
  const ss = sunTimes(kickoff).sunset;
  const ssf = (ss - t0) / span;
  const kickEl = sunPosition(kickoff).elevation;
  const labels: SunCurve["labels"] = [
    { left: 0, text: clockTime(t0), align: "start" },
    { left: 50, text: `${clockTime(kickoff)} pitido`, align: "middle" },
    { left: 100, text: clockTime(t0 + span), align: "end" },
  ];
  if (ssf > 0.08 && ssf < 0.86 && Math.abs(ssf - 0.5) > 0.14) labels.splice(ssf < 0.5 ? 1 : 2, 0, { left: Math.round(ssf * 1000) / 10, text: "focos", align: "middle" });
  return {
    d: pts.join(" "),
    sunset: ssf >= 0 && ssf <= 1 ? ssf : null,
    kick: { x: 250, w: (duration / 240) * 500 },
    sunY: kickEl > -1 ? Math.round((y(kickEl) / 74) * 1000) / 10 : null,
    labels,
    aria: `La luz de esa tarde: el sol se pone a las ${clockTime(ss)}`,
  };
}
