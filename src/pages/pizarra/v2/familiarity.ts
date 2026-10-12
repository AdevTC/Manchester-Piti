// La pizarra — «Familiaridad por posición»: where each player has already lined up in the season's
// officials for matches already played (each official's seven and its system: slot by slot, the zone he
// stood in). «++» = 5 or more matches in that zone, «+» = 2 or more, «!» = never there and not his natural
// position (only once there is a played official to go by). Shown on the cromo, in the fan, «Mover a…» and
// the ficha; «Sugerir siete» uses it to choose who plays out of his natural zone. Pure.
import type { Lineup, Zone } from "../formations";
import { ZONES } from "../formations";
import { slotZone } from "./geometry";
import { defaultTactics } from "../tactics";

export type FamMark = "++" | "+" | "!";

export interface FamTable {
  /** Played matches with an official seven (0 = nothing to go by: no marks at all). */
  games: number;
  /** Appearances by player and zone. */
  by: ReadonlyMap<string, Readonly<Record<Zone, number>>>;
}

export const FAM0: FamTable = { games: 0, by: new Map() };

const ZONE_WORD: Record<Zone, string> = { POR: "portero", DEF: "defensa", MED: "medio", DEL: "delantero" };

/** The table from the season's officials: only those linked to a match already played count, once each. */
export function familiarity(officials: readonly (Pick<Lineup, "formation" | "freeMode" | "slots"> & { matchId: string | null })[], played: (matchId: string) => boolean): FamTable {
  const by = new Map<string, Record<Zone, number>>();
  const seen = new Set<string>();
  for (const o of officials) {
    if (!o.matchId || seen.has(o.matchId) || !played(o.matchId)) continue;
    seen.add(o.matchId);
    const L: Lineup = { formation: o.formation, freeMode: o.freeMode, slots: o.slots, bench: [], roles: {}, tactics: defaultTactics(), playerPositions: {}, pinned: [], drawings: [], plays: [] };
    const counted = new Set<string>();
    o.slots.forEach((s, i) => {
      const id = s.playerId;
      if (!id || counted.has(id)) return;
      counted.add(id);
      const row = by.get(id) ?? { POR: 0, DEF: 0, MED: 0, DEL: 0 };
      row[slotZone(L, i)]++;
      by.set(id, row);
    });
  }
  return { games: seen.size, by };
}

/** How many played officials put him in that zone. */
export const famCount = (t: FamTable, id: string, z: Zone): number => t.by.get(id)?.[z] ?? 0;

/** His mark for a zone (null = none to show). `nat` = the position he plays (unknown = fits anywhere). */
export function famOf(t: FamTable, id: string, z: Zone, nat: Zone | undefined): FamMark | null {
  if (!t.games) return null;
  const n = famCount(t, id, z);
  if (n >= 5) return "++";
  if (n >= 2) return "+";
  if (n === 0 && nat != null && nat !== z) return "!";
  return null;
}

/** The mark in words (never by the sign alone): «se lo sabe: 6 partidos de defensa». */
export function famTxt(t: FamTable, id: string, z: Zone, nat: Zone | undefined): string {
  const m = famOf(t, id, z, nat);
  const n = famCount(t, id, z);
  const where = ZONE_WORD[z];
  if (m === "++") return "se lo sabe: " + n + " partidos de " + where + " en el oficial";
  if (m === "+") return "ya ha jugado de " + where + " (" + n + " partidos en el oficial)";
  if (m === "!") return "nunca ha jugado de " + where + " en el oficial";
  return "";
}

/** «DEF 6 · MED 2» — where he has lined up in the season's played officials (empty = nowhere yet). */
export function famLine(t: FamTable, id: string): string {
  const row = t.by.get(id);
  if (!row) return "";
  return ZONES.filter((z) => row[z] > 0)
    .sort((a, b) => row[b] - row[a])
    .map((z) => z + " " + row[z])
    .join(" · ");
}
