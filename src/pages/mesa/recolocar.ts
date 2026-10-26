// La mesa's «Recolocar» (the canvas's Mesa board): after a change (written at once), the scorer taps two
// players on the pitch who swap places (one pair or several, «Deshacer» the last one) and «Hecho» sends
// just the swaps, stamped with the change's own time (one play, or one wave). «Cambiar de sitio» from the
// ring is the same without a change. At Descanso the changes and the swaps go up as ONE wave (liveEvent
// addMany: the changes first, then the swaps in the order made). Pure: the screens keep the draft.
import { POSITIONS, isPosCode } from "../../../functions/src/positions";
import type { MesaPlayer } from "./types";

/** The most plays a draft sends in one wave (api.ts MAX_WAVE, the server's MAX_MANY; kept here so the
 *  screens don't load Firebase). */
export const DRAFT_MAX = 14;

export interface DraftSub {
  /** Who goes off (or the one sent off whose empty slot is filled). */
  outId: string;
  inId: string;
}
/** Two of ours on the pitch who trade places (`a` = playerId, `b` = inPlayerId of the position_swap). */
export type DraftSwap = readonly [a: string, b: string];

export interface Draft {
  subs: DraftSub[];
  swaps: DraftSwap[];
  /** The time the swaps are stamped with: their change's (they sort right after it), or «Cambiar de sitio»'s. */
  at: { elapsed: number; period: 1 | 2 };
  /** «subbed»: the change is on the pitch, «Recolocar» offered · «swap»: picking pairs. */
  step: "subbed" | "swap";
  /** The first of the pair, picked (swap step). */
  pick: string | null;
  /** «Cambiar de sitio» from the ring: no change in it. */
  alone: boolean;
}

/** One item of the wave (api.ts WaveItem's shape, without the clock). */
export interface DraftItem {
  type: "substitution" | "position_swap";
  playerId: string;
  inPlayerId: string;
}

/** The wave a draft sends: the changes first, then the swaps in the order they were made. */
export function draftItems(d: Pick<Draft, "subs" | "swaps">): DraftItem[] {
  return [
    ...d.subs.map((s): DraftItem => ({ type: "substitution", playerId: s.outId, inPlayerId: s.inId })),
    ...d.swaps.map(([a, b]): DraftItem => ({ type: "position_swap", playerId: a, inPlayerId: b })),
  ];
}

/** «central», «lateral izquierdo»: a position code as the strap says it ("" when unknown). */
export function placeName(code: string | null | undefined): string {
  return code && isPosCode(code) ? POSITIONS[code].name.toLocaleLowerCase("es") : "";
}

/** The pitch and the bench as la mesa draws them with the draft applied: one who comes on takes the shirt
 *  spot, position and gloves of the one going off (or the slot a red emptied), who goes to the bench; a swap
 *  trades spot, position and gloves between two on the pitch. Ids keep their place in the list, so a swap
 *  is a move (the tokens slide), not a new shirt. `minute`: when the ones going off came off. */
export function previewPitch(field: readonly MesaPlayer[], bench: readonly MesaPlayer[], draft: Pick<Draft, "subs" | "swaps"> | null, minute: number): { field: MesaPlayer[]; bench: MesaPlayer[] } {
  if (!draft || (!draft.subs.length && !draft.swaps.length)) return { field: [...field], bench: [...bench] };
  let f = [...field];
  let b = [...bench];
  for (const s of draft.subs) {
    const comer = b.find((p) => p.id === s.inId);
    if (!comer) continue;
    const out = f.find((p) => p.id === s.outId);
    const hole = out ? null : b.find((p) => p.id === s.outId && p.vacancy);
    if (!out && !hole) continue;
    const spot = out ? out.spot : hole?.vacancy?.spot ?? null;
    const pos = out ? out.pos : hole?.vacancy?.code ?? null;
    const on: MesaPlayer = { ...comer, spot, pos, keeper: out ? out.keeper : pos === "POR", vacancy: null, offAt: null, played: true };
    if (out) {
      f = f.map((p) => (p.id === out.id ? on : p));
      b = [...b.filter((p) => p.id !== comer.id), { ...out, spot: null, pos: null, keeper: false, offAt: minute }];
    } else {
      f = [...f, on];
      b = b.filter((p) => p.id !== comer.id).map((p) => (p.id === s.outId ? { ...p, vacancy: null } : p));
    }
  }
  for (const [a, c] of draft.swaps) {
    const pa = f.find((p) => p.id === a);
    const pc = f.find((p) => p.id === c);
    if (!pa || !pc || a === c) continue;
    f = f.map((p) => (p.id === a ? { ...p, spot: pc.spot, pos: pc.pos, keeper: pc.keeper } : p.id === c ? { ...p, spot: pa.spot, pos: pa.pos, keeper: pa.keeper } : p));
  }
  return { field: f, bench: b };
}

/** The positions after some swaps, from where each one plays (id → code): Descanso's «Recolocar». */
export function swappedPlaces(places: ReadonlyMap<string, string | null>, swaps: readonly DraftSwap[]): Map<string, string | null> {
  const out = new Map(places);
  for (const [a, b] of swaps) {
    if (!out.has(a) || !out.has(b) || a === b) continue;
    const pa = out.get(a) ?? null;
    out.set(a, out.get(b) ?? null);
    out.set(b, pa);
  }
  return out;
}
