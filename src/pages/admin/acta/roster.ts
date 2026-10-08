// A season's squad as the acta shows it (pure): season shirt name + dorsal, by dorsal — the same rows
// useAdminData builds for the current season, for any match's season — and the names of every player
// (for events of players who left the squad since).
import { playerForSeason, playerName } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
import type { RosterPlayer } from "../data/useAdminData";

export function rosterFor(players: readonly PlayerDoc[], seasons: readonly { id: string }[], seasonId: string | undefined): RosterPlayer[] {
  if (!seasonId) return [];
  return players
    .filter((p) => p.seasons?.includes(seasonId))
    .map((p) => {
      const s = playerForSeason(p, seasonId, [...seasons]);
      return { id: p.id, name: playerName(s), number: typeof s.number === "number" ? s.number : null, position: String(p.naturalPosition ?? "").toUpperCase(), injured: !!p.injured, doc: p };
    })
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
}

/** id → shirt name in that season (anyone, squad or not); «Jugador» for unknown ids. */
export function namesFor(players: readonly PlayerDoc[], seasons: readonly { id: string }[], seasonId: string | undefined): (id: string | undefined) => string {
  const map = new Map(players.map((p) => [p.id, playerName(seasonId ? playerForSeason(p, seasonId, [...seasons]) : p)]));
  return (id) => (id ? (map.get(id) ?? "Jugador") : "—");
}

const POSITION: Record<string, string> = { POR: "Portero", PORTERO: "Portero", DEF: "Defensa", DEFENSA: "Defensa", MED: "Medio", MEDIO: "Medio", MEDIOCENTRO: "Medio", DEL: "Delantero", DELANTERO: "Delantero" };
/** «Portero» for POR / Portero…; «Jugador» when unknown. */
export const positionName = (p: string) => POSITION[p.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()] ?? "Jugador";
/** «POR», «DEF», «MED», «DEL» (the picker's tag); "" when unknown. */
export function positionCode(p: string): string {
  const n = positionName(p);
  return n === "Jugador" ? "" : n.slice(0, 3).toUpperCase();
}
