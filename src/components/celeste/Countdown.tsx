import { useClock } from "../../hooks/useClock";
import { countdownParts } from "../../lib/partidos";
import { Flip } from "./Flip";

// The countdown to kick-off on the stadium board (Partidos and the match page): days, hours, minutes and
// seconds as flip tiles (styles/partidos.css), on the server's clock (useClock), ticking every second.
// Screen readers hear one label, never the ticking seconds; with reduced motion the tiles don't flip (CSS).
export function Countdown({ target }: { target: number }) {
  const now = useClock(1000);
  const c = countdownParts(target, now);
  return (
    <div className="pt-cd" role="timer" aria-label={`Faltan ${Number(c.d)} días, ${Number(c.h)} horas y ${Number(c.m)} minutos`}>
      {(
        [
          [c.d, "DÍAS"],
          [c.h, "HORAS"],
          [c.m, "MIN"],
          [c.s, "SEG"],
        ] as const
      ).map(([v, l]) => (
        <div key={l}>
          <Flip value={v} />
          <small>{l}</small>
        </div>
      ))}
    </div>
  );
}
