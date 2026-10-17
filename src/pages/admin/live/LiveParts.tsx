// The live pieces Hoy shows (as on the canvas): the log «Lo que va pasando» (`.evl`) and the running clock.
// Scoring (the pads, the picker) is la mesa's now (src/pages/mesa).
import { MatchClockDisplay } from "../../../components/celeste/MatchClockControl";
import type { ClubMatch } from "../../../lib/clubData";
import { useState } from "react";
import { useClock } from "../../../hooks/useClock";
import { clockText } from "../data/moments";
import { AdIcon } from "../ui/icons";
import type { LogRow } from "./liveModel";

/** `.evl`: the events, newest first; rows written after it mounted rise in. */
export function LiveLog({ rows, label }: { rows: LogRow[]; label?: string }) {
  const [initial] = useState(() => new Set(rows.map((r) => r.id)));
  return (
    <ul className="evl" aria-label={label}>
      {rows.map((e) => (
        <li key={e.id} className={[e.cls, initial.has(e.id) ? "" : "fresh"].filter(Boolean).join(" ") || undefined}>
          <span className="m">{e.minute}′</span>
          <span className="ic">{e.icon ? <AdIcon name={e.icon} size={18} /> : null}</span>
          <span>
            {e.text} {e.detail ? <small>{e.detail}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** «31:12» since kick-off, ticking every second (only this text re-renders). */
export function LiveClock({ start, match }: { start: number; match?: ClubMatch }) {
  const now = useClock(1000);
  return match?.clock ? <MatchClockDisplay match={match} /> : <span>{clockText(start, now)}</span>;
}
