// La pizarra — «Familiaridad por posición»: where each player has already lined up in the season's
// officials for matches already played (each official's seven and its system: slot by slot, the exact
// position he stood in — encaje.slotCode of the stored board — and its zone). For a player with an exact
// position: «++» = 5 or more matches at the slot's position, «+» = 2 or more, «!» = never there and fuera
// (encaje.logicGrade). Who is known only by his line keeps the zone's count: «!» = never in that zone and
// not his natural one. No marks until there is a played official to go by. Shown on the cromo, in the
// fan, «Mover a…» and the ficha; «Sugerir siete» uses the count (by exact position for who has one) to
// choose who plays out of his place. Pure.
import type { Lineup, Zone } from "../formations";
import { ZONES } from "../formations";
import { POS_CODES, POSITIONS, type PosCode } from "../../../lib/positions";
import { slotZone } from "./geometry";
import { hasFitData, logicGrade, out, slotCode } from "./encaje";
import { natOf, type Squad } from "./model";
import { defaultTactics } from "../tactics";

export type FamMark = "++" | "+" | "!";

export interface FamTable {
  /** Played matches with an official seven (0 = nothing to go by: no marks at all). */
  games: number;
  /** Appearances by player and zone. */
  by: ReadonlyMap<string, Readonly<Record<Zone, number>>>;
  /** Appearances by player and exact position (the slot's code on the stored board). */
  byCode: ReadonlyMap<string, Readonly<Partial<Record<PosCode, number>>>>;
}

export const FAM0: FamTable = { games: 0, by: new Map(), byCode: new Map() };

const ZONE_WORD: Record<Zone, string> = { POR: "portero", DEF: "defensa", MED: "medio", DEL: "delantero" };

/** The table from the season's officials: only those linked to a match already played count, once each. */
export function familiarity(officials: readonly (Pick<Lineup, "formation" | "freeMode" | "slots"> & { matchId: string | null })[], played: (matchId: string) => boolean): FamTable {
  const by = new Map<string, Record<Zone, number>>();
  const byCode = new Map<string, Partial<Record<PosCode, number>>>();
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
      const codes = byCode.get(id) ?? {};
      const code = slotCode(L, i);
      codes[code] = (codes[code] ?? 0) + 1;
      byCode.set(id, codes);
    });
  }
  return { games: seen.size, by, byCode };
}

/** How many played officials put him in that zone. */
export const famCount = (t: FamTable, id: string, z: Zone): number => t.by.get(id)?.[z] ?? 0;

/** How many played officials put him at that exact position. */
export const famCodeCount = (t: FamTable, id: string, code: PosCode): number => t.byCode.get(id)?.[code] ?? 0;

const markOf = (n: number, never: boolean): FamMark | null => (n >= 5 ? "++" : n >= 2 ? "+" : n === 0 && never ? "!" : null);

/** His mark for a zone (null = none to show). `nat` = the position he plays (unknown = fits anywhere). */
export function famOf(t: FamTable, id: string, z: Zone, nat: Zone | undefined): FamMark | null {
  if (!t.games) return null;
  return markOf(famCount(t, id, z), nat != null && nat !== z);
}

/** The mark in words (never by the sign alone): «se lo sabe: 6 partidos de defensa». */
export function famTxt(t: FamTable, id: string, z: Zone, nat: Zone | undefined): string {
  return markTxt(famOf(t, id, z, nat), famCount(t, id, z), ZONE_WORD[z]);
}

function markTxt(m: FamMark | null, n: number, where: string): string {
  if (m === "++") return "se lo sabe: " + n + " partidos de " + where + " en el oficial";
  if (m === "+") return "ya ha jugado de " + where + " (" + n + " partidos en el oficial)";
  if (m === "!") return "nunca ha jugado de " + where + " en el oficial";
  return "";
}

/** His mark at slot i of this board, and in words: by the slot's exact position for a player with an
 *  exact outfield position («!» = never there and fuera), else by its zone (famOf, as it always was). */
export function famSlot(t: FamTable, L: Lineup, sq: Squad, id: string, i: number): { mark: FamMark | null; txt: string } {
  if (!hasFitData([id], sq, L)) {
    const z = slotZone(L, i);
    const nat = natOf(L, sq, id);
    return { mark: famOf(t, id, z, nat), txt: famTxt(t, id, z, nat) };
  }
  if (!t.games) return { mark: null, txt: "" };
  const code = slotCode(L, i);
  const n = famCodeCount(t, id, code);
  const m = markOf(n, out(logicGrade(L, sq, id, i)));
  return { mark: m, txt: markTxt(m, n, POSITIONS[code].name.toLowerCase()) };
}

/** «DEF 6 · MED 2» — where he has lined up in the season's played officials (empty = nowhere yet); with
 *  `byCode` (a player with an exact position, as famSlot decides) by exact position: «MCD 4 · MC 2 ·
 *  DFC 1». Most first, then the catalogue's order. */
export function famLine(t: FamTable, id: string, byCode = false): string {
  if (byCode) {
    const row = t.byCode.get(id);
    if (!row) return "";
    const n = (c: PosCode) => row[c] ?? 0;
    return POS_CODES.filter((c) => n(c) > 0)
      .sort((a, b) => n(b) - n(a))
      .map((c) => c + " " + n(c))
      .join(" · ");
  }
  const row = t.by.get(id);
  if (!row) return "";
  return ZONES.filter((z) => row[z] > 0)
    .sort((a, b) => row[b] - row[a])
    .map((z) => z + " " + row[z])
    .join(" · ");
}
