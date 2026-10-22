// A page's real kit stills, rendered by useShirtStills and handed down so every shirt on the page (the pitch, a
// ranking, a ballot, the MVP) wears the real kit: the player's own still, his name and number printed by the 3D
// scene as on the real shirt, once it is ready; before, the kit's blank still under a set number; undefined before
// both and on the server, where the drawn shirt stands in.
import { createContext } from "react";

export type Kit = "home" | "away";

export interface KitStill {
  src: string;
  /** The player's own still (name and number printed by the scene): the shirt sets no number over it. */
  printed: boolean;
}
/** The still for a kit and, when the shirt stands for a player, his dorsal. */
export type KitStills = (kit: Kit, num?: string) => KitStill | undefined;

export const KitStillContext = createContext<KitStills>(() => undefined);

/** The name each dorsal prints on its back (capitals, as the kit prints them): a dorsal two players share prints
 *  nobody's name, so neither shirt wears the other's. */
export function printNames(players: readonly { name: string; num: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  const shared = new Set<string>();
  for (const p of players) {
    const name = p.name.trim().toLocaleUpperCase("es");
    if (!p.num || !name) continue;
    if (out.has(p.num) && out.get(p.num) !== name) shared.add(p.num);
    else out.set(p.num, name);
  }
  for (const n of shared) out.delete(n);
  return out;
}
