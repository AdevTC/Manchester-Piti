// «Encuestas» as the CL- board draws them (part-vestuario vx.g.encuestas): the order of the cards (the poll a
// notice named first, then derived/polls visiblePolls: open first) and the board's lines in words.
import { closesText, visiblePolls, type Poll } from "../../../lib/derived/polls";

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

/** «De Huberoski · Cierra en 3 días · Todos ven quién votó qué.» (+ «Varias respuestas» when it is). */
export function encuestasMeta(poll: Pick<Poll, "authorName" | "closesAt" | "closedAt" | "multi">, now: number): string {
  const parts = [`De ${poll.authorName}`, closesText(poll, now)];
  if (poll.multi) parts.push("Varias respuestas");
  parts.push("Todos ven quién votó qué.");
  return parts.join(" · ");
}

/** «Votaron: 8 personas, tú también.» / «Votaron: 1 persona.»; nobody yet: open or closed. */
export function encuestasVotersLine(voters: number, mine: boolean, open: boolean): string {
  if (!voters) return open ? "Aún no ha votado nadie." : "Nadie votó.";
  return `Votaron: ${plural(voters, "persona", "personas")}${mine ? ", tú también." : "."}`;
}
