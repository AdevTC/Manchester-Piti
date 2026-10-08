// /profile › Avisos · Ajustes · Capitanía: the small pure pieces of their panels (the topic list, the
// ◀ ▶ selectors' wrap-around, the door in words), apart from the components so they are unit-tested.
import { TOPIC_LABELS, type Topic } from "../../lib/push";

/** The ids of «Qué te avisamos», in order: push.ts's topics, then the door for captains. */
export function topicIds(captain: boolean): Topic[] {
  return [...TOPIC_LABELS.map((t) => t.id), ...(captain ? (["door"] as Topic[]) : [])];
}

export type Opt<K extends string> = readonly [K, string];

/** The next option, wrapping around (◀ = -1, ▶ = +1). */
export function cycle<K extends string>(opts: readonly Opt<K>[], value: K, d: 1 | -1): K {
  const i = Math.max(0, opts.findIndex((o) => o[0] === value));
  return opts[(i + d + opts.length) % opts.length][0];
}

const WORDS = ["Ninguna", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];
/** «Dos peticiones esperan tu sí o tu no.» */
export function doorLead(n: number): string {
  if (n <= 0) return "Nadie llama ahora. Cuando alguien pida entrar, sale aquí.";
  const w = WORDS[n] ?? String(n);
  return n === 1 ? `${w} petición espera tu sí o tu no.` : `${w} peticiones esperan tu sí o tu no.`;
}
/** «hace 2 h», «hace 1 día». */
export function agoText(at: number, now: number): string {
  if (!at) return "";
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}
