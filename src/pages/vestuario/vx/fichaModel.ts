// «Vincula tu ficha» block (CL- boards part-vestuario vx.g.ficha), pure: the season's fichas nobody has linked
// yet («Pellete · 20», by dorsal) and the one that looks like his nickname («Se parece a tu nombre»).
import { suggestFicha } from "../../../lib/vestuario";

export interface FichaOption {
  id: string;
  label: string;
}

/** «Pellete · 20» (just the name without a dorsal). */
export const fichaLabel = (name: string, num: string): string => (num ? `${name} · ${num}` : name);

/** Lower case without accents, for the search. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/** Whether a shirt answers to the search: its name holds it, or its dorsal starts with it. */
export const matchShirt = (q: string, name: string, num: string) => {
  const f = fold(q);
  return !f || fold(name).includes(f) || (!!num && num.startsWith(f));
};

export type TileState = "mine" | "free" | "taken";
/** Every shirt of the squad (its order), with whose it is: yours, free, or someone's. */
export function fichaTiles(squad: readonly { id: string; name: string; num: string }[], links: readonly { playerId: string }[], mine: string | null) {
  const taken = new Set(links.map((l) => l.playerId));
  return squad.map((p) => ({ ...p, state: (p.id === mine ? "mine" : taken.has(p.id) ? "taken" : "free") as TileState }));
}

export type FichaPhase = "pick" | "wait" | "done";
/** The room's kicker, title and line in each phase (the captain links at once; nobody free: he asks a captain). */
export function fichaHead(phase: FichaPhase, o: { admin: boolean; noFree: boolean; linkedName: string }) {
  if (phase === "done")
    return { kick: "Tu ficha · quién eres en la plantilla", title: `Tu ficha ya está vinculada: ${o.linkedName}.`, sub: "Tu nombre y tu dorsal van impresos en tu camiseta. Si no es la tuya, díselo a un capitán." };
  const kick = "Tu ficha · primer paso, recomendado";
  if (phase === "wait") return { kick, title: "Solicitud enviada: tu ficha, en revisión.", sub: "Un capitán la aprueba desde la puerta. Mientras tanto, todo el vestuario funciona igual." };
  if (o.noFree) return { kick, title: "Todas las camisetas tienen dueño", sub: "No queda ninguna ficha libre esta temporada: pídesela a un capitán." };
  return { kick, title: "¿Cuál es tu camiseta?", sub: o.admin ? "Elige tu nombre. Como capitán, se vincula al instante." : "Elige tu nombre. Lo aprueba un capitán; mientras tanto, todo el vestuario funciona igual." };
}

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
