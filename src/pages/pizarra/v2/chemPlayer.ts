// La pizarra · Bloque 4 — la química por jugador: 0–3 diamonds on each cromo, from where he plays (in his
// place — the encaje's logicGrade ≥ 2 — lights one; adapted lights none; out of his place he can't have
// more than one) and his links (a «++» link is one diamond, a
// «+» half of one; two at most), and the team's sum over 21 next to the 0–100. While a player is carried
// over a spot, what dropping him there would do to that sum («+2 química aquí»). Pure.
import type { Lineup } from "../formations";
import { inPlace, logicGrade, out } from "./encaje";
import type { Squad } from "./model";
import { chemOf, type Chem } from "./quimica";

export type Diamonds = 0 | 1 | 2 | 3;
export const TEAM_MAX = 21;

/** The diamonds of the player in slot i (0 for an empty slot). */
export function playerDiamonds(L: Lineup, sq: Squad, ch: Chem, i: number): Diamonds {
  const id = L.slots[i]?.playerId;
  if (!id || !sq.byId.has(id)) return 0;
  const g = logicGrade(L, sq, id, i);
  const pos = inPlace(g) ? 1 : 0;
  const lk = ch.links.filter((l) => l.i === i || l.j === i).reduce((a, l) => a + (l.t === 3 ? 1 : l.t === 2 ? 0.5 : 0), 0);
  let d = pos + Math.min(2, Math.floor(lk + 1e-9));
  if (out(g)) d = Math.min(d, 1);
  return Math.max(0, Math.min(3, d)) as Diamonds;
}

/** Every slot's diamonds (by slot index). */
export function allDiamonds(L: Lineup, sq: Squad, ch: Chem = chemOf(L, sq)): Diamonds[] {
  return L.slots.map((_, i) => playerDiamonds(L, sq, ch, i));
}

/** The team's diamonds (0–21). */
export function teamDiamonds(L: Lineup, sq: Squad, ch: Chem = chemOf(L, sq)): number {
  return allDiamonds(L, sq, ch).reduce<number>((a, d) => a + d, 0);
}

/** The three marks on a cromo for its diamonds. */
export const diamondMarks = (d: Diamonds): [boolean, boolean, boolean] => [d >= 1, d >= 2, d >= 3];

/** «química 2 de 3». */
export const diamondsAria = (d: Diamonds): string => "química " + d + " de 3";

export interface DropPreview {
  /** The team's diamonds after the drop minus now. */
  delta: number;
  /** The carried player's own diamonds where he would land. */
  mine: Diamonds;
  /** «+2 química aquí», «−1 química aquí», «= química aquí». */
  txt: string;
}

/** What dropping turns `L` into `next` does to the team's diamonds (`id` = the player carried). */
export function dropPreview(L: Lineup, next: Lineup, sq: Squad, id: string): DropPreview {
  const delta = teamDiamonds(next, sq) - teamDiamonds(L, sq);
  const k = next.slots.findIndex((s) => s.playerId === id);
  const mine = k >= 0 ? playerDiamonds(next, sq, chemOf(next, sq), k) : 0;
  const txt = (delta > 0 ? "+" + delta : delta < 0 ? "−" + -delta : "=") + " química aquí";
  return { delta, mine, txt };
}
