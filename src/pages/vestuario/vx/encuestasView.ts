// «Encuestas» as the canvas prototype draws the room (SalaEncuestas.dc.html): the order and the groups of the cards
// (the poll a notice named first, then derived/polls visiblePolls: open first, then closed this week), the room's
// title and line, and every card's words. Pure: the room (Encuestas.tsx) reads the data and draws.
import { closesText, isPollOpen, outcomeText, visiblePolls, type Outcome, type Poll, type PollDurationId } from "../../../lib/derived/polls";

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The polls to draw: the one /vestuario/encuestas/<id> names first (even closed long ago, while the reader
 *  still has it), then the vestuario's list. `missing`: the address names a poll that is not there (deleted). */
export function encuestasOrder(polls: readonly Poll[], now: number, pollId: string | null): { list: Poll[]; missing: boolean } {
  const visible = visiblePolls(polls, now);
  if (!pollId) return { list: visible, missing: false };
  const named = polls.find((p) => p.id === pollId);
  if (!named) return { list: visible, missing: true };
  return { list: [named, ...visible.filter((p) => p.id !== pollId)], missing: false };
}

export interface EncuestasGroups {
  /** The poll the address names («La del enlace»), open or closed. */
  focus: Poll | null;
  /** «Abiertas» (newest first), the named one left out. */
  open: Poll[];
  /** «Cerradas esta semana» (most recently closed first), the named one left out. */
  closed: Poll[];
  /** Every open poll, the named one too (the title counts them). */
  allOpen: Poll[];
  missing: boolean;
}
/** The room's groups: «La del enlace», «Abiertas», «Cerradas esta semana». */
export function encuestasGroups(polls: readonly Poll[], now: number, pollId: string | null): EncuestasGroups {
  const { list, missing } = encuestasOrder(polls, now, pollId);
  const focus = pollId ? (list.find((p) => p.id === pollId) ?? null) : null;
  const rest = list.filter((p) => p !== focus);
  const open = rest.filter((p) => isPollOpen(p, now));
  const closed = rest.filter((p) => !isPollOpen(p, now));
  const allOpen = focus && isPollOpen(focus, now) ? [focus, ...open] : open;
  return { focus, open, closed, allOpen, missing };
}

/** The open polls you haven't voted in (`voted`: poll id → whether you voted; missing while its votes load). */
export const pendingPolls = (open: readonly Poll[], voted: Readonly<Record<string, boolean | undefined>>) => open.filter((p) => voted[p.id] === false);
/** Every open poll's votes read (so «Has votado en todas» can be said). */
export const allKnown = (open: readonly Poll[], voted: Readonly<Record<string, boolean | undefined>>) => open.every((p) => voted[p.id] !== undefined);

/** The room's title (its status in words) and line. */
export function encuestasHead(s: { loading: boolean; failed: boolean; open: readonly Poll[]; pending: readonly Poll[]; known: boolean }): { title: string; sub: string } {
  if (s.loading) return { title: "Mirando las encuestas…", sub: "Un momento." };
  if (s.failed) return { title: "Las encuestas no cargan", sub: "No se pudieron leer las encuestas. Prueba a recargar dentro de un rato." };
  const n = s.open.length;
  const title = !n ? "Ninguna abierta" : n === 1 ? "1 encuesta abierta" : `${n} encuestas abiertas`;
  const p = s.pending[0];
  if (p)
    return {
      title,
      sub: `Te falta votar «${p.question}». ${p.multi ? "Marca las que te vengan y pulsa Votar" : "Toca una opción y ya cuenta"}; todos ven quién votó qué.`,
    };
  if (n && s.known) return { title, sub: "Has votado en todas. ¿Quieres preguntar algo? Todos ven quién votó qué." };
  return { title, sub: "Pregunta algo al equipo y vota. Todos ven quién votó qué." };
}

/** «Abiertas»'s meta: what you still have to vote. */
export function openGroupMeta(pending: number, known: boolean): string {
  if (pending) return `Te falta votar ${pending === 1 ? "una" : pending} · la más nueva arriba`;
  return known ? "Has votado en todas · la más nueva arriba" : "La más nueva arriba";
}

/** The card's status chip: «Cierra en 3 días» (amber when it closes within the day) or «Cerrada». */
export function pollStatus(poll: Pick<Poll, "closesAt" | "closedAt">, now: number): { text: string; cls: "is-ok" | "is-warn" | "is-off"; open: boolean } {
  const open = isPollOpen(poll, now);
  const text = closesText(poll, now);
  return { text, open, cls: !open ? "is-off" : /hora|min/.test(text) ? "is-warn" : "is-ok" };
}

/** A closed poll's result: «Gana X», «Empate entre X e Y» or «Nadie votó.». */
export const resultText = (poll: Pick<Poll, "options">, outcome: Outcome) => (outcome.kind === "none" ? "Nadie votó." : outcomeText(poll, outcome));

/** An option's tag: « · gana» (alone on top) or « · empate» (shared top), "" otherwise or with no votes. */
export function optionTag(id: string, outcome: Outcome): string {
  if (outcome.kind === "none" || !outcome.ids.includes(id)) return "";
  return outcome.kind === "winner" ? " · gana" : " · empate";
}

/** What a screen reader hears for an option: «No · gana, 3 votos, 60 por ciento, tu voto». */
export function optionAria(label: string, tag: string, count: number, pct: number, mine: boolean): string {
  return `${label}${tag}, ${plural(count, "voto", "votos")}, ${pct} por ciento${mine ? ", tu voto" : ""}`;
}

/** Several answers: the line next to «Votar». */
export function sendHint(changed: boolean, picked: number, saved: number): string {
  if (changed) return picked ? `Marcadas: ${picked}. Pulsa para guardarlo.` : "Sin marcar nada quitas tu voto.";
  return saved ? "Tu voto está guardado. Marca otras para cambiarlo." : "Marca las que te vengan y pulsa Votar.";
}

/** «Votaron: 8 personas, tú también.» / «Votaron: 1 persona.»; nobody yet: open or closed. */
export function encuestasVotersLine(voters: number, mine: boolean, open: boolean): string {
  if (!voters) return open ? "Aún no ha votado nadie." : "Nadie votó.";
  return `Votaron: ${plural(voters, "persona", "personas")}${mine ? ", tú también." : "."}`;
}

/** The composer's line under «Nueva encuesta». */
export const composerLine = (mineOpen: number, max: number) => (mineOpen ? `Tienes ${mineOpen} de ${max} abiertas. Le llega un aviso a todo el equipo.` : "Le llega un aviso a todo el equipo.");

/** The empty room's heading: nothing at all, or only closed ones. */
export const emptyHead = (anyPoll: boolean) => (anyPoll ? "No hay encuestas abiertas. ¿Preguntas tú?" : "No hay encuestas ahora mismo. ¿Preguntas tú?");

/** One-tap starts for the empty room (they fill the composer; nothing is published until «Publicar»). */
export const POLL_TEMPLATES: readonly { q: string; opts: readonly string[]; multi: boolean; duration: PollDurationId }[] = [
  { q: "¿Cena el viernes?", opts: ["Sí, me apunto", "Solo una caña", "No puedo"], multi: false, duration: "3d" },
  { q: "¿Qué equipación llevamos?", opts: ["La celeste", "La de fuera", "La tercera"], multi: false, duration: "1d" },
  { q: "¿Hora del entreno?", opts: ["19:00", "20:00", "21:00"], multi: true, duration: "1d" },
];
