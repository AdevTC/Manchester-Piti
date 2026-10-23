import { useCallback, useMemo } from "react";
import type { StillRequest } from "./scene";
import { printNames, type Kit, type KitStills } from "./kitStill";
import { useShirtStills } from "./useShirtStills";

const SEP = "\u001f";
const blankOf = (kit: Kit, theme: StillRequest["theme"]): StillRequest => ({ kit, theme, name: "", num: "" });
const ownOf = (kit: Kit, theme: StillRequest["theme"], num: string, name: string): StillRequest => ({ kit, theme, name, num });

/**
 * The page's KitStillContext value: requested once per page, off the main thread, for the kits it wears (the first
 * one first) — each kit's blank still, then every player's own printed still (keyed as useShirtStills keys them, so
 * the plantilla's and the ficha's stills are the same ones). `on` is false on the server and until hydration, so
 * the first client render matches the server's drawn shirts.
 */
export function usePageKitStills({ on, theme, kits, players }: { on: boolean; theme: StillRequest["theme"]; kits: readonly Kit[]; players: readonly { name: string; num: string }[] }): KitStills {
  // Callers pass fresh arrays each render: key on their content, so the returned lookup is a new function only when
  // the inputs or the stills change (KitStillContext readers can skip the page's other re-renders).
  const printedKey = [...printNames(players)].map(([num, name]) => `${num}${SEP}${name}`).join("\n");
  const kitsKey = kits.join(SEP);
  const names = useMemo(() => new Map(printedKey ? printedKey.split("\n").map((l) => l.split(SEP) as [string, string]) : []), [printedKey]);
  const reqs = useMemo(() => {
    if (!on) return [];
    const list = kitsKey.split(SEP) as Kit[];
    return [...list.map((kit) => blankOf(kit, theme)), ...list.flatMap((kit) => [...names].map(([num, name]) => ownOf(kit, theme, num, name)))];
  }, [on, theme, kitsKey, names]);
  const still = useShirtStills(reqs, { offMainThread: true });
  return useCallback<KitStills>((kit, num) => {
    if (!on) return undefined;
    const name = num ? names.get(num) : undefined;
    const printed = num && name ? still(ownOf(kit, theme, num, name)) : undefined;
    if (printed) return { src: printed, printed: true };
    const plain = still(blankOf(kit, theme));
    return plain ? { src: plain, printed: false } : undefined;
  }, [on, theme, names, still]);
}
