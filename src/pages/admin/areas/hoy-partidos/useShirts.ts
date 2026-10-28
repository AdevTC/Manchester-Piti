// HOY Y PARTIDOS · the photos of the printed shirts (jersey3d stills, rendered once and kept on the device) of a list
// of players in one kit.
import { useCallback, useMemo } from "react";
import { useShirtStills } from "../../../../components/jersey3d/useShirtStills";
import { useShell } from "../../shell/context";
import type { Kit, ShirtWho } from "./Shirt";

const req = (w: ShirtWho, kit: Kit, theme: "dark" | "light") => ({ kit, theme, name: (w.name || "").toLocaleUpperCase("es"), num: w.number != null && w.number !== "" ? String(w.number) : "" });

/** The photos of a list of shirts in one kit: `still(who)` is the photo's address, or undefined while it renders. */
export function useShirts(people: readonly ShirtWho[], kit: Kit): (w: ShirtWho) => string | undefined {
  const { theme } = useShell();
  const reqs = useMemo(() => people.map((p) => req(p, kit, theme)), [people, kit, theme]);
  const still = useShirtStills(reqs, { offMainThread: true });
  return useCallback((w: ShirtWho) => still(req(w, kit, theme)), [still, kit, theme]);
}

