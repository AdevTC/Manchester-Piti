// La mesa's «Recolocar» (the canvas's Mesa board): a change at la mesa is held for a moment as a draft, so
// the scorer can tap two players on the pitch and swap their places (one pair or several, «Deshacer» the
// last one) before it goes up. The change(s) and the swaps then go up as ONE wave (liveEvent addMany: the
// changes first, then the swaps in the order made), all or none. «Cambiar de sitio» from the ring is the
// same draft without a change. Pure: EnJuego keeps the draft, the tests run it.
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
  /** The clock when the first change was tapped: the wave goes up with that time, not «Hecho»'s. */
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
