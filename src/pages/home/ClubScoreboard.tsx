// The club scoreboard: a real object standing behind the far goal (DOM over the ground, so the server paints
// it). Countdown before the match (ticking every second, client side; a screen reader hears the minutes once
// as the label, never the seconds), the minute and «+2» live, «Final», «acta lista», the next match after.
import { useClock } from "../../hooks/useClock";
import { countdownText, type BoardFace } from "./inicioModel";

interface Props {
  face: BoardFace;
  /** ms of the kick-off to count down to (antes, not scrubbed): the face ticks by itself. */
  countdownTo?: number | null;
  /** The plate under the face (the club's first sponsor). */
  plate?: string;
  /** «flip» once (the lights came on) / «gold» (a goal of ours being celebrated) / «rival». */
  accent?: "flip" | "gold" | "rival" | null;
  stale?: boolean;
}

function Ticking({ to }: { to: number }) {
  const now = useClock(1000);
  return <>{countdownText(to - now)}</>;
}

export function ClubScoreboard({ face, countdownTo, plate, accent, stale }: Props) {
  const h = `ei-sb-n${accent === "flip" ? " flip" : ""}${accent === "gold" ? " flip gold" : ""}`;
  const a = `ei-sb-n${accent === "flip" || accent === "rival" ? " flip" : ""}`;
  return (
    <div className={`ei-sb${stale ? " off" : ""}`} role="img" aria-label={face.label}>
      <div className="ei-sb-cap" />
      <div className="ei-sb-box">
        <div className="ei-sb-face">
          <span className="ei-sb-tm">{face.home}</span>
          <span className="ei-sb-dg">
            <span className={h}>{face.h}</span>
            <span className="ei-sb-x">:</span>
            <span className={a}>{face.a}</span>
          </span>
          <span className="ei-sb-tm r">{face.away}</span>
          <span className="ei-sb-row">
            <span className="ei-sb-k">{face.k}</span>
            <span className="ei-sb-c">{countdownTo ? <Ticking to={countdownTo} /> : face.c}</span>
          </span>
        </div>
      </div>
      {plate && <div className="ei-sb-plate">{plate}</div>}
      <div className="ei-sb-legs">
        <i />
        <i />
      </div>
    </div>
  );
}
