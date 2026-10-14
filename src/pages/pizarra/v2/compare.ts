// La pizarra «Noche de partido» — Comparar: two sevens face to face. The tale of the tape is what
// matters for a lineup (química, system, media, the seven's minutes this season, how many play in their
// place, how many of the board's galones are on the pitch) and who changes, marked on the
// pitch: a dashed gold ring where a player of the other board would come in, a red one on whoever would
// go out. Besides another board, the board can face «El siete que jugó» (or the convocatoria's siete) of
// its match. Pure.
import type { Lineup } from "../formations";
import { systemDef } from "../../../lib/formations";
import { CAMS, proj, slotPos, type CamName } from "./geometry";
import { matchShort, type CalMatch } from "./boards";
import { fmtMinutes } from "../../../lib/derived/minutes";
import { GALONES, type Squad } from "./model";
import { chem } from "./quimica";
import { boardInPlace } from "./encaje";
import { startersOn } from "./record";

export interface TapeRow {
  k: string;
  a: string | number;
  b: string | number;
  /** The better side wears the gold underline ("w"); rows without a better side have none. */
  ca: "" | "w";
  cb: "" | "w";
}

const placedIds = (L: Lineup): string[] => L.slots.map((s) => s.playerId).filter((x): x is string => !!x);

/** Mean form rating of the placed seven (0 with nobody placed). */
export function meanForm(L: Lineup, sq: Squad): number {
  const rts = placedIds(L)
    .map((id) => sq.byId.get(id)?.rt)
    .filter((x): x is number => typeof x === "number");
  return rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;
}

/** The season minutes of the seven on the pitch, added up. */
export const sevenMinutes = (L: Lineup, sq: Squad): number => placedIds(L).reduce((s, id) => s + (sq.byId.get(id)?.stats.minutes ?? 0), 0);

/** How many of the seven are in their place (encaje.boardInPlace — the Sistema's and the química's
 *  count: preferida, también or a «Jugar de» there; a player known only by his line, on his line); an
 *  unknown position doesn't count. */
export const naturalCount = (L: Lineup, sq: Squad): number => boardInPlace(L, sq);

/** How many of the galones are worn by someone on the pitch. */
export const galonesOn = (L: Lineup): number => {
  const on = new Set(placedIds(L));
  return GALONES.filter((g) => {
    const id = L.roles[g.key];
    return !!id && on.has(id);
  }).length;
};

export function tape(A: Lineup, B: Lineup, sq: Squad): TapeRow[] {
  const num = (k: string, a: number, b: number, show: (n: number) => string | number = (n) => n): TapeRow => ({ k, a: show(a), b: show(b), ca: a > b ? "w" : "", cb: b > a ? "w" : "" });
  return [
    num("Química", chem(A, sq).v, chem(B, sq).v),
    { k: "Sistema", a: A.freeMode ? "Libre" : systemDef(A.formation).label, b: B.freeMode ? "Libre" : systemDef(B.formation).label, ca: "", cb: "" },
    num("Media", meanForm(A, sq), meanForm(B, sq)),
    num("Minutos del siete", sevenMinutes(A, sq), sevenMinutes(B, sq), (n) => fmtMinutes(n)),
    num("En su sitio", naturalCount(A, sq), naturalCount(B, sq), (n) => n + "/7"),
    num("Galones en el campo", galonesOn(A), galonesOn(B), (n) => n + "/" + GALONES.length),
  ];
}

// ── «El siete que jugó» ──
/** The option id of the linked match's seven in Comparar's «Contra». */
export const PLAYED_ID = "partido";

/** «El siete que jugó · J8 · MAD SKY» once played (the convocatoria's siete before), or null when the
 *  match has no starters. */
export function playedOption(m: CalMatch | null): { id: string; name: string } | null {
  if (!m?.conv?.starters.length) return null;
  return { id: PLAYED_ID, name: (m.played ? "El siete que jugó · " : "El siete convocado · ") + matchShort(m) };
}

/**
 * The match's starters as a seven on this board (only the names are stored, not the spots): placed as
 * «Copiar el siete del último partido» places them (record.startersOn, on this board's own slots and
 * with its «Jugar de»: the best encaje with exact positions, else each one on his line, the keeper in
 * goal), so «En su sitio» counts them where they fit. The board's galones stay, so the tape says which
 * of them played.
 */
export function playedSeven(A: Lineup, starters: readonly string[], sq: Squad): Lineup {
  const seven = startersOn(A, starters, sq);
  const slots = A.slots.map((s, i) => ({ ...s, playerId: seven[i] ?? null }));
  return { ...A, slots, bench: [], plays: [], drawings: [] };
}

export interface Changes {
  /** In the other board and not in this one (they would come in). */
  ins: string[];
  /** In this board and not in the other (they would go out). */
  outs: string[];
}

/** Who changes from this board (A) to the other (B), by player id, in slot order. */
export function changes(A: Lineup, B: Lineup): Changes {
  const a = new Set(placedIds(A));
  const b = new Set(placedIds(B));
  return { ins: placedIds(B).filter((id) => !a.has(id)), outs: placedIds(A).filter((id) => !b.has(id)) };
}

export interface CmpMark {
  key: string;
  /** "" = comes in (dashed gold), "out" = goes out (red). */
  cls: "" | "out";
  x: string;
  y: string;
}

/** The changes marked on the pitch: where the other board puts who comes in, and who goes out here. */
export function cmpMarks(A: Lineup, B: Lineup, cam: CamName): CmpMark[] {
  const C = CAMS[cam];
  const inA = new Set(placedIds(A));
  const inB = new Set(placedIds(B));
  const out: CmpMark[] = [];
  const mark = (L: Lineup, i: number, id: string, cls: CmpMark["cls"]) => {
    const p = slotPos(L, i);
    const q = proj(C, p.u, p.v);
    out.push({ key: cls + id, cls, x: q.x.toFixed(2), y: (q.y - 2).toFixed(2) });
  };
  B.slots.forEach((s, i) => {
    if (s.playerId && !inA.has(s.playerId)) mark(B, i, s.playerId, "");
  });
  A.slots.forEach((s, i) => {
    if (s.playerId && !inB.has(s.playerId)) mark(A, i, s.playerId, "out");
  });
  return out;
}
