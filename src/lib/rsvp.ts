// The convocatoria's answers in numbers, with «Sin responder» as a state of its own: the convocados
// (titulares + banquillo) who haven't said Voy, Duda or No puedo yet. Pure.
export type Response = "yes" | "no" | "maybe";

export interface RsvpSummary {
  yes: number;
  maybe: number;
  no: number;
  /** Convocados with no answer (0 while the match has no convocatoria). */
  sin: number;
  /** «3 van · 1 en duda · 2 sin responder» (the zeros left out; empty when there is nothing to say). */
  txt: string;
}

export function rsvpSummary(answers: readonly { response: Response; playerId: string | null }[], called: readonly string[]): RsvpSummary {
  const n = { yes: 0, maybe: 0, no: 0 };
  const answered = new Set<string>();
  for (const a of answers) {
    n[a.response]++;
    if (a.playerId) answered.add(a.playerId);
  }
  const sin = [...new Set(called)].filter((id) => !answered.has(id)).length;
  const parts = [
    n.yes ? n.yes + (n.yes === 1 ? " va" : " van") : "",
    n.maybe ? n.maybe + " en duda" : "",
    n.no ? n.no + (n.no === 1 ? " no puede" : " no pueden") : "",
    sin ? sin + " sin responder" : "",
  ].filter(Boolean);
  return { ...n, sin, txt: parts.join(" · ") };
}
