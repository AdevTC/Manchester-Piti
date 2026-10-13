// El código exacto de cada casilla de una pizarra guardada (lineups/{id}), para la web y las funciones.
// Es el slotCode de la pizarra (src/pages/pizarra/v2/encaje.ts) sin React ni su Lineup: un sistema lee
// sus casillas del catálogo; el modo libre toma, entre las posiciones de la línea que marca la
// profundidad de la casilla, la más cercana a donde está. La casilla 0 es siempre el portero.
import { isFormationName, systemDef, type FormationName } from "./formations.js";
import { POS_CODES, POSITIONS, type Line, type PosCode } from "./positions.js";

/** What a stored board needs to say who plays where (a pizarra Lineup is one). */
export interface BoardLike {
  formation?: unknown;
  freeMode?: unknown;
  slots?: { playerId?: string | null; x?: number; y?: number }[];
}

const SLOTS = 7;
const DEFAULT_FORMATION: FormationName = "2-3-1";
const OUTFIELD = POS_CODES.filter((c) => c !== "POR");

const formationOf = (b: BoardLike): FormationName => (isFormationName(b.formation) ? b.formation : DEFAULT_FORMATION);

// Free mode, as the pizarra's geometry reads it (slotZone's depth bands; planeDist2's 1.42 : 1 pitch).
const freeLine = (v: number): Line => (v >= 62 ? "DEF" : v >= 36 ? "MED" : "DEL");
const planeDist2 = (u1: number, v1: number, u2: number, v2: number): number => (u1 - u2) ** 2 + ((v1 - v2) * 1.42) ** 2;

function freeCode(x: number, y: number): PosCode {
  const line = freeLine(y);
  const codes = OUTFIELD.filter((c) => POSITIONS[c].line === line);
  let best: PosCode = codes[0] ?? OUTFIELD[0];
  let bd = Infinity;
  for (const c of codes) {
    const d = planeDist2(x, y, POSITIONS[c].x, POSITIONS[c].y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** The 7 slots' exact codes: the formation's (unknown → 2-3-1), or in free mode the nearest position
 *  of the slot's depth line to where it stands; slot 0 is always POR. */
export function boardSlotCodes(b: BoardLike): PosCode[] {
  const spots = systemDef(formationOf(b)).spots;
  const free = b.freeMode === true;
  return Array.from({ length: SLOTS }, (_, i) => {
    if (i === 0) return "POR";
    const s = b.slots?.[i];
    if (free && s && typeof s.x === "number" && typeof s.y === "number" && Number.isFinite(s.x) && Number.isFinite(s.y)) return freeCode(s.x, s.y);
    return spots[i]?.[0] ?? "MC";
  });
}

/** playerId → the code of his slot (empty slots skipped; a player twice keeps his first slot). */
export function boardCodeByPlayer(b: BoardLike): Record<string, PosCode> {
  const codes = boardSlotCodes(b);
  const out: Record<string, PosCode> = {};
  (b.slots ?? []).slice(0, SLOTS).forEach((s, i) => {
    const id = s?.playerId;
    if (typeof id === "string" && id && !Object.hasOwn(out, id)) out[id] = codes[i];
  });
  return out;
}

/** The board's system: «libre» in free mode, else its formation id (unknown → 2-3-1). */
export function boardSystem(b: BoardLike): string {
  return b.freeMode === true ? "libre" : formationOf(b);
}
