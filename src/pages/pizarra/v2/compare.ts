// La pizarra «Noche de partido» — Comparar: two sevens face to face. The tale of the tape (química,
// system, mean form, goals+assists per line) and who changes, marked on the pitch: a dashed gold ring
// where a player of the other board would come in, a red one on whoever would go out. Pure.
import type { Lineup } from "../formations";
import { CAMS, proj, slotPos, type CamName } from "./geometry";
import type { Squad } from "./model";
import { chem, type Chem } from "./quimica";

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

const lineGA = (c: Chem, z: "DEF" | "MED" | "DEL"): number => {
  const l = c.lines.find((x) => x.z === z);
  return l ? l.g + l.a : 0;
};

export function tape(A: Lineup, B: Lineup, sq: Squad): TapeRow[] {
  const ca = chem(A, sq);
  const cb = chem(B, sq);
  const num = (k: string, a: number, b: number): TapeRow => ({ k, a, b, ca: a > b ? "w" : "", cb: b > a ? "w" : "" });
  return [
    num("Química", ca.v, cb.v),
    { k: "Sistema", a: A.freeMode ? "Libre" : A.formation, b: B.freeMode ? "Libre" : B.formation, ca: "", cb: "" },
    num("Forma media", meanForm(A, sq), meanForm(B, sq)),
    num("DEF · G+A", lineGA(ca, "DEF"), lineGA(cb, "DEF")),
    num("MED · G+A", lineGA(ca, "MED"), lineGA(cb, "MED")),
    num("DEL · G+A", lineGA(ca, "DEL"), lineGA(cb, "DEL")),
  ];
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
