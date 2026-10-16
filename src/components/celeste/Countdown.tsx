import { useClock } from "../../hooks/useClock";
import { countdownParts } from "../../lib/partidos";
import { Flip } from "./Flip";

// The countdown to kick-off on the stadium board (Partidos and the match page): days, hours, minutes and
// seconds as flip tiles (styles/partidos.css), on the server's clock (useClock), ticking every second.
// Screen readers hear one label, never the ticking seconds nor the tiles' captions (DÍAS, HORAS…); with
// reduced motion the tiles don't flip (CSS).

const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Countdown({ target }: { target: number }) {
  const now = useClock(1000);
  const c = countdownParts(target, now);
  const [d, h, m] = [Number(c.d), Number(c.h), Number(c.m)];
  // «Faltan 2 días, 3 horas y 4 minutos» / «Falta 1 día, 1 hora y 1 minuto» (the verb agrees with the first count)
  const label = `${d === 1 ? "Falta" : "Faltan"} ${unit(d, "día", "días")}, ${unit(h, "hora", "horas")} y ${unit(m, "minuto", "minutos")}`;
  return (
    <div className="pt-cd" role="timer" aria-label={label}>
      {(
        [
          [c.d, "DÍAS"],
          [c.h, "HORAS"],
          [c.m, "MIN"],
          [c.s, "SEG"],
        ] as const
      ).map(([v, l]) => (
        <div key={l} aria-hidden="true">
          <Flip value={v} />
          <small>{l}</small>
        </div>
      ))}
    </div>
  );
}
