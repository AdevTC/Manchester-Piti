// CLUB · the printed shirt stills of the rooms: whose shirt (print and dorsal in a season) and one renderer per screen.
import { useShirtStills } from "../../../../components/jersey3d/useShirtStills";
import { nameFor } from "../../../../lib/clubData";
import type { PlayerDoc } from "../../../../lib/schemas";
import { numberIn } from "../../club/plantillaLogic";
import { useShell } from "../../shell/context";

export interface ShirtOf {
  name: string;
  num: string;
}
/** The shirt of a player in a season: its print (upper case) and dorsal. */
export function shirtOf(p: PlayerDoc | undefined, seasonId: string): ShirtOf {
  if (!p) return { name: "", num: "" };
  const n = numberIn(p, seasonId);
  return { name: nameFor(p, seasonId).toLocaleUpperCase("es"), num: n != null ? String(n) : "" };
}

/** One renderer for a screen: `src(shirt)` is its still (undefined while it renders). */
export function useStills(shirts: readonly ShirtOf[]): (s: ShirtOf) => string | undefined {
  const { theme } = useShell();
  const req = (s: ShirtOf) => ({ kit: "home" as const, theme, name: s.name, num: s.num });
  const still = useShirtStills(shirts.filter((s) => s.name).map(req), { offMainThread: shirts.length > 3 });
  return (s) => (s.name ? still(req(s)) : undefined);
}
