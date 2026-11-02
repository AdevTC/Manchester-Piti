// Partido's tests: the J3 of the fake world at a phase, with the clock la mesa would have (a live phase needs a
// started clock: that is what makes it live).
import type { PzMatch, PzWorld } from "../../store/types";

export function matchAt(W: PzWorld, phase: PzMatch["phase"], o: { startedAgoMin?: number; events?: NonNullable<PzMatch["cal"]["events"]>; at?: number } = {}): PzMatch {
  const m = W.matches[0];
  const started = W.now - (o.startedAgoMin ?? 23) * 60000;
  const clock =
    phase === "juego"
      ? { revision: 2, phase: "first" as const, firstStartedAt: started }
      : phase === "descanso"
        ? { revision: 3, phase: "halftime" as const, firstStartedAt: started, firstEndedAt: started + 25 * 60000 }
        : phase === "jugado"
          ? { revision: 5, phase: "ended" as const, firstStartedAt: started, firstEndedAt: started + 25 * 60000, secondStartedAt: started + 30 * 60000, endedAt: started + 55 * 60000 }
          : undefined;
  const at = o.at ?? (phase === "antes" ? m.at : started);
  return { ...m, phase, at, played: phase === "jugado", cal: { ...m.cal, dateMs: at, ...(clock ? { clock } : {}), ...(o.events ? { events: o.events } : {}) } };
}
