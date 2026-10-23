// «Vincula tu ficha» block (CL- boards part-vestuario vx.g.ficha), pure: the season's fichas nobody has linked
// yet («Pellete · 20», by dorsal) and the one that looks like his nickname («Se parece a tu nombre»).
import { suggestFicha } from "../../../lib/vestuario";

export interface FichaOption {
  id: string;
  label: string;
}

/** «Pellete · 20» (just the name without a dorsal). */
export const fichaLabel = (name: string, num: string): string => (num ? `${name} · ${num}` : name);

/**
 * The free fichas of the season's squad (in its order: by dorsal) and the suggestion for `nick` among them.
 * `names`: every name a ficha answers to (shirt name, first name, full name), for the suggestion.
 */
export function fichaChoices(squad: readonly { id: string; name: string; num: string }[], links: readonly { playerId: string }[], nick: string, names: (id: string) => string[]) {
  const taken = new Set(links.map((l) => l.playerId));
  const options: FichaOption[] = squad.filter((p) => !taken.has(p.id)).map((p) => ({ id: p.id, label: fichaLabel(p.name, p.num) }));
  const hit = suggestFicha(nick, options.map((o) => ({ id: o.id, names: names(o.id) })));
  return { options, suggestion: (hit && options.find((o) => o.id === hit.id)) ?? null };
}
