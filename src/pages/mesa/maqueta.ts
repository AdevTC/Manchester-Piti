// DEV only, never in a build (useMaqueta loads it with a dynamic import behind import.meta.env.DEV): `?fase=antes|juego|pausa|descanso|final|sinred` on
// la mesa replays a played match up to that moment, with production-shaped data, so its screens can be looked at and
// compared with the boards without writing anything (the actions do nothing). juego = minute 23, descanso = the end
// of the 1ª, final = all of it. Like the boards' «Datos: reales».
import type { ClubMatch } from "../../lib/clubData";
import type { MatchClock } from "../../../functions/src/matchClock";
import type { MesaActions } from "./types";

export type MaquetaFase = "antes" | "juego" | "pausa" | "descanso" | "final" | "sinred";
const FASES = new Set<string>(["antes", "juego", "pausa", "descanso", "final", "sinred"]);

/** The `?fase=` of the address, in the dev server only. */
export function maquetaFase(): MaquetaFase | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const f = new URLSearchParams(window.location.search).get("fase");
  return f && FASES.has(f) ? (f as MaquetaFase) : null;
}

/** `?gol` (with `?fase=juego`): starts «Gol del Piti», as the boards' hoja=gol does (the sheets are in the real
 *  address now: ?hoja=reloj, ?hoja=jugador&j=<id>…). */
export function maquetaGol(): boolean {
  return import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("gol");
}

/** The match as it stood at that moment of `fase` (`now` the page's clock). */
export function maquetaMatch(m: ClubMatch, fase: MaquetaFase, now: number): ClubMatch {
  const duration = Math.max(10, m.duration ?? 50);
  const half = Math.round(duration / 2);
  const upto = fase === "antes" ? -1 : fase === "descanso" ? half * 60 : fase === "final" ? Infinity : 23 * 60;
  const secs = (e: { elapsedSeconds?: number; minute?: number }) => e.elapsedSeconds ?? (e.minute ?? 0) * 60;
  const events = (m.events ?? []).filter((e) => secs(e) <= upto).map((e) => ({ ...e, period: (secs(e) > half * 60 ? 2 : 1) as 1 | 2, elapsedSeconds: secs(e) }));
  const t0 = now - 23 * 60_000;
  const clock: MatchClock =
    fase === "antes"
      ? { revision: 0, phase: "ready" }
      : fase === "descanso"
      ? { revision: 3, phase: "halftime", firstStartedAt: now - half * 60_000 - 90_000, firstEndedAt: now - 90_000 }
      : fase === "final"
        ? { revision: 5, phase: "ended", firstStartedAt: now - (duration + 10) * 60_000, firstEndedAt: now - (half + 10) * 60_000, secondStartedAt: now - (half + 5) * 60_000, endedAt: now - 5 * 60_000 }
        : { revision: 2, phase: "first", firstStartedAt: t0, ...(fase === "pausa" ? { heldAt: now } : {}) };
  return { ...m, status: "scheduled", events, clock } as ClubMatch;
}

/** Actions that answer and write nothing. */
export function maquetaActions(real: MesaActions): MesaActions {
  const ok = async () => undefined;
  return { ...real, edit: ok, remove: ok, undo: ok, clock: ok, publish: ok, reopen: ok, addGuest: async () => "guest:g9", setDuration: ok, saveReport: ok, setScorers: ok, add: () => "live-maqueta", addMany: (items) => items.map((_, i) => `live-maqueta-${i}`), resend: () => undefined, discard: () => undefined };
}
