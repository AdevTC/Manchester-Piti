// DEV only («?maqueta=primera&quien=fan»): the boards' «Maqueta» strip on the real page — a played match turned
// into any moment of its day (its own plays up to that minute, a clock at that minute, the acta not yet out…)
// and the page seen by any viewer, so every state can be checked against the P- boards with production's
// data (the narrated analysis kept, so the numbers and the pressure match the boards'), without writing anything
// to the emulators. Never read in a production build (import.meta.env.DEV).
import type { ClubMatch } from "../../../lib/clubData";
import { dateMillis } from "../../../lib/clubData";
import { eventMinute } from "../../../lib/partidos";
import type { Fase } from "./model";

const MIN = 60_000;
export const MAQUETA_FASES: readonly Fase[] = ["antes", "pitido", "primera", "descanso", "segunda", "final", "acta", "despues", "aplazado", "pendiente"];
export type Quien = "fan" | "socio" | "jugador" | "anotador" | "admin";

/** The match as it stood at `fase` (the board's minutes: 23 in the first half, the break, 36 in the second),
 *  the clock to read it with, and whether its MVP vote is open. */
export function maquetaOf(m: ClubMatch, fase: Fase): { match: ClubMatch; now: number; voteOpen: boolean } {
  const kick = dateMillis(m.date);
  const dur = m.duration ?? 50;
  const half = (dur / 2) * MIN;
  const upTo = (n: number) => (m.events ?? []).filter((e) => (eventMinute(e) ?? 0) <= n);
  const unplayed = { ...m, status: "scheduled" as const, ledger: undefined, goalsFor: undefined, goalsAgainst: undefined, liveEndedAt: undefined, weatherAtKickoff: undefined, voteClosesAt: undefined };
  switch (fase) {
    case "antes":
      return { match: { ...unplayed, events: [], clock: { revision: 0, phase: "ready" } }, now: kick - (2 * 60 + 14) * MIN, voteOpen: false };
    case "pitido":
      return { match: { ...unplayed, events: [], clock: { revision: 0, phase: "ready" } }, now: kick + 2 * MIN, voteOpen: false };
    case "primera": {
      const now = kick + 23 * MIN;
      return { match: { ...unplayed, events: upTo(23), clock: { revision: 1, phase: "first", firstStartedAt: now - 22.5 * MIN } }, now, voteOpen: false };
    }
    case "descanso": {
      const now = kick + half + 4 * MIN;
      return { match: { ...unplayed, events: upTo(dur / 2), clock: { revision: 2, phase: "halftime", firstStartedAt: kick, firstEndedAt: kick + half } }, now, voteOpen: false };
    }
    case "segunda": {
      const now = kick + half + 16 * MIN;
      return { match: { ...unplayed, events: upTo(36), clock: { revision: 3, phase: "second", firstStartedAt: kick, firstEndedAt: kick + half, secondStartedAt: now - (35.5 * MIN - half) } }, now, voteOpen: false };
    }
    case "final": {
      const end = kick + half * 2 + 5 * MIN;
      return { match: { ...unplayed, events: m.events ?? [], clock: { revision: 4, phase: "ended", firstStartedAt: kick, firstEndedAt: kick + half, secondStartedAt: kick + half + 5 * MIN, endedAt: end } }, now: end + 3 * MIN, voteOpen: false };
    }
    case "acta":
      return { match: m, now: kick + 3 * 24 * 60 * MIN, voteOpen: true };
    case "despues":
      return { match: m, now: kick + 9 * 24 * 60 * MIN, voteOpen: false };
    case "aplazado":
      return { match: { ...unplayed, events: [], status: "postponed", clock: undefined }, now: kick - 26 * 60 * MIN, voteOpen: false };
    case "pendiente":
      return { match: { ...unplayed, events: [], clock: { revision: 0, phase: "ready" } }, now: kick + dur * MIN + 3 * 60 * MIN, voteOpen: false };
  }
}

export const isQuien = (v: unknown): v is Quien => v === "fan" || v === "socio" || v === "jugador" || v === "anotador" || v === "admin";
export const isFase = (v: unknown): v is Fase => (MAQUETA_FASES as readonly unknown[]).includes(v);
