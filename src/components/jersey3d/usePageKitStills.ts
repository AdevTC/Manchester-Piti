import type { StillRequest } from "./scene";
import { printNames, type Kit, type KitStills } from "./kitStill";
import { useShirtStills } from "./useShirtStills";

/**
 * The page's KitStillContext value: requested once per page, off the main thread, for the kits it wears (the first
 * one first) — each kit's blank still, then every player's own printed still (keyed as useShirtStills keys them, so
 * the plantilla's and the ficha's stills are the same ones). `on` is false on the server and until hydration, so
 * the first client render matches the server's drawn shirts.
 */
export function usePageKitStills({ on, theme, kits, players }: { on: boolean; theme: StillRequest["theme"]; kits: readonly Kit[]; players: readonly { name: string; num: string }[] }): KitStills {
  const names = printNames(players);
  const blank = (kit: Kit): StillRequest => ({ kit, theme, name: "", num: "" });
  const own = (kit: Kit, num: string, name: string): StillRequest => ({ kit, theme, name, num });
  const reqs = on ? [...kits.map(blank), ...kits.flatMap((kit) => [...names].map(([num, name]) => own(kit, num, name)))] : [];
  const still = useShirtStills(reqs, { offMainThread: true });
  return (kit, num) => {
    if (!on) return undefined;
    const name = num ? names.get(num) : undefined;
    const printed = num && name ? still(own(kit, num, name)) : undefined;
    if (printed) return { src: printed, printed: true };
    const plain = still(blank(kit));
    return plain ? { src: plain, printed: false } : undefined;
  };
}
