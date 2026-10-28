// HOY Y PARTIDOS · a match's convocatoria by answer (the boards' SCM.rsvp): who comes, who doubts, who doesn't (with the
// ones an absence covers that day, «ausente hasta el 12 nov»), who hasn't answered; one row per player of the
// match's season squad. Pure.
import { dateMillis } from "../../../../../functions/src/matchEngine";
import { absenceOn, matchDay, type Absence } from "../../../../lib/derived/absences";
import type { AdminMatch } from "../../data/adminLogic";
import { isoDay } from "./fmt";

export type AnswerId = "yes" | "maybe" | "no" | "none";
export interface AnswerPerson {
  id: string;
  /** An absence covers the match's day (and he did not say «Voy»). */
  absent: boolean;
  /** «12 nov», the absence's last day. */
  until: string;
}
export interface AnswerGroup {
  id: AnswerId;
  name: string;
  /** How one of them is said: «viene», «en duda», «no viene», «sin responder». */
  word: string;
  people: AnswerPerson[];
}
export interface Answers {
  groups: AnswerGroup[];
  /** Each player's answer in words («viene», «ausente hasta el 12 nov»…). */
  word: Map<string, string>;
  counts: { yes: number; maybe: number; no: number; none: number; absent: number; all: number };
}

const NAMES: [AnswerId, string, string][] = [
  ["yes", "Vienen", "viene"],
  ["maybe", "En duda", "en duda"],
  ["no", "No vienen", "no viene"],
  ["none", "Sin responder", "sin responder"],
];

export function answersOf(o: { match: AdminMatch; roster: readonly { id: string }[]; answers: readonly { response: "yes" | "no" | "maybe"; playerId: string | null }[]; absences: readonly Absence[] }): Answers {
  const by = new Map<string, "yes" | "no" | "maybe">();
  for (const a of o.answers) if (a.playerId) by.set(a.playerId, a.response);
  const day = matchDay(dateMillis(o.match.date));
  const groups: Record<AnswerId, AnswerPerson[]> = { yes: [], maybe: [], no: [], none: [] };
  const word = new Map<string, string>();
  let absent = 0;
  for (const p of o.roster) {
    const r = by.get(p.id);
    const ab = day && r !== "yes" ? absenceOn(o.absences, { playerId: p.id }, day) : null;
    if (ab) {
      absent++;
      const until = isoDay(ab.to);
      groups.no.push({ id: p.id, absent: true, until });
      word.set(p.id, `ausente hasta el ${until}`);
      continue;
    }
    const g: AnswerId = r ?? "none";
    groups[g].push({ id: p.id, absent: false, until: "" });
    word.set(p.id, NAMES.find((n) => n[0] === g)![2]);
  }
  return {
    groups: NAMES.map(([id, name, w]) => ({ id, name, word: w, people: groups[id] })),
    word,
    counts: { yes: groups.yes.length, maybe: groups.maybe.length, no: groups.no.length - absent, none: groups.none.length, absent, all: o.roster.length },
  };
}
