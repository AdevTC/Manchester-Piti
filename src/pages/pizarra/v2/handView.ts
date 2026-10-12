// What the selected player's action bar says (pure): who is in the hand, where, and what a tap does now.
import { rtTxt } from "./model";

export interface SelBarView {
  id: string;
  name: string;
  num: number;
  /** The rating as printed («—» before his first match). */
  rt: string;
  /** His slot's label on the pitch, else his natural position. */
  pos: string;
  gk: boolean;
  /** On the pitch (swap / capitán / galones) or from the bench (comes in). */
  onPitch: boolean;
  captain: boolean;
  /** «ADRIÁN T.C. · DC · en la mano». */
  kick: string;
  /** What a tap does now. */
  txt: string;
}

/** What the bar says for the player in the hand (`slot` = his slot's label when he is on the pitch). */
export function selBarView(p: { id: string; name: string; num: number; rt: number; unrated?: boolean; pos?: string | null }, slot: string | null, captain: boolean): SelBarView {
  const onPitch = slot != null;
  return {
    id: p.id,
    name: p.name,
    num: p.num,
    rt: rtTxt(p),
    pos: slot ?? p.pos ?? "—",
    gk: p.pos === "POR",
    onPitch,
    captain: onPitch && captain,
    kick: p.name + " · " + (onPitch ? slot + " · en la mano" : "del banquillo · en la mano"),
    txt: onPitch ? "Toca con quién se cambia: otro del campo o uno del banquillo" : "Toca a quién sustituye o un hueco libre",
  };
}

/** A toolbar's roving index after a key: → ↓ next, ← ↑ previous (both wrap), Home / End the ends; null =
 *  not a toolbar key. */
export function rove(key: string, at: number, n: number): number | null {
  if (n <= 0) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return (at + 1) % n;
  if (key === "ArrowLeft" || key === "ArrowUp") return (at - 1 + n) % n;
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  return null;
}

