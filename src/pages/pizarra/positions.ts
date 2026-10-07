// Natural positions arrive in more than one spelling (the squad admin wrote words: «Portero», «Defensa
// central», «Mediocentro»…). The board only speaks POR / DEF / MED / DEL: this reads any of them, in any
// case and with or without accents; anything else is «no position» (never a guess). Pure.
import type { Zone } from "./formations";

const WORDS: Record<string, Zone> = {};
const add = (z: Zone, ...ws: string[]) => ws.forEach((w) => (WORDS[w] = z));
add("POR", "por", "portero", "portera", "porteros", "guardameta", "arquero", "gk");
add("DEF", "def", "defensa", "defensas", "defensor", "defensora", "defensores", "defensivo", "lateral", "laterales", "central", "centrales", "carrilero", "libero", "dfc", "ld", "li", "lib");
add("MED", "med", "medio", "medios", "media", "mediocampista", "centrocampista", "centrocampistas", "mediocentro", "mediapunta", "pivote", "interior", "volante", "mc", "mcd", "mco", "mi", "md");
add("DEL", "del", "delantero", "delantera", "delanteros", "extremo", "extremos", "punta", "ariete", "dc", "ed", "ei");

/** POR / DEF / MED / DEL from whatever was stored; undefined when it isn't a known position. */
export function normZone(x: unknown): Zone | undefined {
  if (typeof x !== "string") return undefined;
  const s = x
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (!s) return undefined;
  // The first word decides: «Lateral derecho» → DEF, «Delantero centro» → DEL, «Medio centro» → MED.
  const first = s.split(/[\s\-_/.,·]+/)[0];
  return WORDS[s] ?? WORDS[first];
}
